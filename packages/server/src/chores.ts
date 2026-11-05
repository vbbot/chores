import { randomUUID } from 'node:crypto';

import type {
  AssignmentMode,
  ChoreInstance,
  ChoreTaskType,
  ChoreTemplate,
  MemberBalance,
  MemberLoad,
  UnassignedBalance,
  User,
} from '@chores/domain';
import {
  addDays,
  calculateNextDueAfter,
  calculateNextDueDate,
  completionXp,
  defaultAssignmentMode,
  emptyMemberLoad,
  londonDateString,
  londonToday,
  nextRotationAssignee,
  pickBalancedAssignee,
  templateStreak,
} from '@chores/domain';

import { dbAdmin } from './firebase';
import { householdCollection, listRooms } from './households';
import { ApiError } from './http';
import { listMembers } from './users';

export type ChoreTemplateInput = {
  room_id?: string | null;
  name: string;
  description?: string | null;
  task_type?: ChoreTaskType;
  due_date?: string | null;
  frequency?: string;
  frequency_days?: number | null;
  estimated_minutes?: number | null;
  priority?: string;
  assignment_mode?: AssignmentMode;
  fixed_assignee_id?: string | null;
  rotation_member_ids?: string[] | null;
};

type ChoreInstanceFilter = {
  status?: string;
  due_date?: string;
  due_before?: string;
  assigned_to?: string;
  unassigned?: string;
  task_type?: string;
};

interface AssignmentContext {
  householdId: string;
  today: string;
  members: User[];
  templates: ChoreTemplate[];
  instances: ChoreInstance[];
}

interface AssignmentChoice {
  assignee: string | null;
  rotationCursor?: string | null;
}

function asTemplate(id: string, data: Record<string, unknown>): ChoreTemplate {
  return {
    task_type: 'recurring',
    assignment_mode: 'balanced',
    fixed_assignee_id: null,
    rotation_member_ids: null,
    rotation_last_assignee_id: null,
    ...(data as unknown as Omit<ChoreTemplate, 'id'>),
    id,
  };
}

function asInstance(id: string, data: Record<string, unknown>): ChoreInstance {
  return {
    task_type: 'recurring',
    assigned_at: null,
    assigned_by: null,
    ...(data as unknown as Omit<ChoreInstance, 'id'>),
    id,
  };
}

function instanceId(templateId: string, dueDate: string): string {
  return `${templateId}_${dueDate}`;
}

function estimatedMinutes(template: ChoreTemplate | undefined): number {
  return Math.max(1, template?.estimated_minutes ?? 15);
}

function instanceRef(householdId: string, id: string) {
  return householdCollection(householdId, 'choreInstances').doc(id);
}

async function assignmentContext(householdId: string): Promise<AssignmentContext> {
  const [members, templates, instancesResult] = await Promise.all([
    listMembers(householdId),
    listChoreTemplates(householdId),
    householdCollection(householdId, 'choreInstances').get(),
  ]);

  return {
    householdId,
    today: londonToday(),
    members,
    templates,
    instances: instancesResult.docs.map((doc) => asInstance(doc.id, doc.data())),
  };
}

export function calculateLoads(context: AssignmentContext): Record<string, MemberLoad> {
  const loads: Record<string, MemberLoad> = {};
  context.members.forEach((member) => {
    loads[member.id] = emptyMemberLoad();
  });

  const from = addDays(context.today, -6);
  const minutesByTemplate = new Map(
    context.templates.map((template) => [template.id, estimatedMinutes(template)])
  );

  context.instances.forEach((instance) => {
    const minutes = minutesByTemplate.get(instance.template_id) ?? 15;

    if (instance.status === 'pending' && instance.assigned_to && loads[instance.assigned_to]) {
      const load = loads[instance.assigned_to];
      load.minutes += minutes;
      load.open_chores += 1;
      if (
        instance.assigned_at &&
        (!load.last_assigned_at || instance.assigned_at > load.last_assigned_at)
      ) {
        load.last_assigned_at = instance.assigned_at;
      }
    }

    if (
      instance.status === 'completed' &&
      instance.completed_by &&
      instance.completed_at &&
      loads[instance.completed_by]
    ) {
      const completedDate = londonDateString(new Date(instance.completed_at));
      if (completedDate >= from && completedDate <= context.today) {
        loads[instance.completed_by].minutes += minutes;
      }
    }
  });

  return loads;
}

function validateMember(context: AssignmentContext, memberId: string | null | undefined): string | null {
  if (!memberId) return null;
  if (!context.members.some((member) => member.id === memberId)) {
    throw new ApiError('Assignee is not in this household', 400);
  }
  return memberId;
}

function rotationIdsFor(
  context: AssignmentContext,
  rotationIds: string[] | null | undefined
): string[] | null {
  if (!rotationIds || rotationIds.length === 0) return null;
  const valid = rotationIds.filter((id) =>
    context.members.some((member) => member.id === id)
  );
  return valid.length > 0 ? valid : null;
}

function chooseAssignee(
  context: AssignmentContext,
  template: ChoreTemplate
): AssignmentChoice {
  const mode = template.assignment_mode ?? 'balanced';

  if (mode === 'anyone') return { assignee: null };

  if (mode === 'fixed') {
    const fixed = context.members.find(
      (member) => member.id === template.fixed_assignee_id
    );
    if (fixed) return { assignee: fixed.id };
    // A member may leave the household. Fall back instead of blocking generation.
    return {
      assignee: pickBalancedAssignee(context.members, calculateLoads(context)),
    };
  }

  if (mode === 'rotate') {
    const memberIds = context.members.map((member) => member.id);
    const allowed = rotationIdsFor(context, template.rotation_member_ids);
    const next = nextRotationAssignee(
      memberIds,
      allowed,
      template.rotation_last_assignee_id ?? null
    );
    return { assignee: next, rotationCursor: next };
  }

  return {
    assignee: pickBalancedAssignee(context.members, calculateLoads(context)),
  };
}

async function createInstance(
  context: AssignmentContext,
  template: ChoreTemplate,
  dueDate: string,
  options?: {
    instanceId?: string;
    manualAssignee?: string | null;
    assignedBy?: string | null;
  }
): Promise<boolean> {
  const generatedId =
    options?.instanceId ??
    (template.task_type === 'one_off'
      ? randomUUID()
      : instanceId(template.id, dueDate));

  const ref = instanceRef(context.householdId, generatedId);
  if ((await ref.get()).exists) return false;

  const choice =
    options?.manualAssignee !== undefined
      ? { assignee: options.manualAssignee }
      : chooseAssignee(context, template);

  const now = new Date().toISOString();
  const data = {
    template_id: template.id,
    household_id: context.householdId,
    assigned_to: choice.assignee,
    assigned_at: choice.assignee ? now : null,
    assigned_by: options?.assignedBy ?? null,
    completed_by: null,
    due_date: dueDate,
    completed_at: null,
    status: 'pending' as const,
    task_type: template.task_type ?? 'recurring',
    notes: null,
    created_at: now,
  };

  try {
    await ref.create(data);
  } catch (error) {
    // Concurrent completion already created the next instance.
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }

  if (choice.rotationCursor) {
    await householdCollection(context.householdId, 'choreTemplates')
      .doc(template.id)
      .update({ rotation_last_assignee_id: choice.rotationCursor });
    template.rotation_last_assignee_id = choice.rotationCursor;
  }

  context.instances.push(asInstance(generatedId, data));
  return true;
}

export async function listChoreTemplates(householdId: string): Promise<ChoreTemplate[]> {
  const result = await householdCollection(householdId, 'choreTemplates').get();
  return result.docs
    .map((doc) => asTemplate(doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function listChoreTemplatesWithStreaks(
  householdId: string
): Promise<ChoreTemplate[]> {
  const [templates, instances] = await Promise.all([
    listChoreTemplates(householdId),
    householdCollection(householdId, 'choreInstances').get(),
  ]);
  const today = londonToday();

  return templates.map((template) => {
    if (template.task_type === 'one_off') {
      return { ...template, streak_current: 0, streak_best: 0 };
    }
    const history = instances.docs
      .filter((doc) => doc.data().template_id === template.id)
      .map((doc) => doc.data() as ChoreInstance);
    const streak = templateStreak(history, today);
    return {
      ...template,
      streak_current: streak.current,
      streak_best: streak.best,
    };
  });
}

export async function createChoreTemplate(
  householdId: string,
  input: ChoreTemplateInput
): Promise<ChoreTemplate> {
  if (input.room_id) {
    const room = await householdCollection(householdId, 'rooms').doc(input.room_id).get();
    if (!room.exists) throw new ApiError('Room not found', 404);
  }

  const members = await listMembers(householdId);
  if (members.length === 0) throw new ApiError('Household has no members', 400);

  const taskType: ChoreTaskType = input.task_type ?? 'recurring';
  const mode: AssignmentMode =
    input.assignment_mode ?? defaultAssignmentMode(members.length);

  const baseContext: AssignmentContext = {
    householdId,
    today: londonToday(),
    members,
    templates: [],
    instances: [],
  };

  const fixedAssignee =
    mode === 'fixed'
      ? validateMember(baseContext, input.fixed_assignee_id)
      : null;
  if (mode === 'fixed' && !fixedAssignee) {
    throw new ApiError('Choose a household member for this chore.', 400);
  }

  const rotationMembers =
    mode === 'rotate' ? rotationIdsFor(baseContext, input.rotation_member_ids) : null;

  const today = londonToday();
  const dueDate =
    taskType === 'one_off'
      ? input.due_date ?? today
      : today;
  const id = randomUUID();
  const template = {
    household_id: householdId,
    room_id: input.room_id ?? null,
    name: input.name.trim(),
    description: input.description ?? null,
    task_type: taskType,
    assignment_mode: mode,
    fixed_assignee_id: fixedAssignee,
    rotation_member_ids: rotationMembers,
    rotation_last_assignee_id: null,
    frequency: taskType === 'one_off' ? 'one_off' : input.frequency ?? 'weekly',
    frequency_days: taskType === 'one_off' ? null : input.frequency_days ?? null,
    estimated_minutes: input.estimated_minutes ?? 15,
    priority: input.priority ?? 'medium',
    is_active: true,
    next_due_date: dueDate,
    created_at: new Date().toISOString(),
  };

  await householdCollection(householdId, 'choreTemplates').doc(id).set(template);

  const context = await assignmentContext(householdId);
  const created = asTemplate(id, template as unknown as Record<string, unknown>);
  await createInstance(context, created, dueDate);

  return created;
}

export async function updateChoreTemplate(
  householdId: string,
  templateId: string,
  input: Partial<ChoreTemplateInput> & { is_active?: boolean }
): Promise<ChoreTemplate> {
  const ref = householdCollection(householdId, 'choreTemplates').doc(templateId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Chore template not found', 404);

  const current = asTemplate(templateId, doc.data() as Record<string, unknown>);
  const taskType = current.task_type ?? 'recurring';
  if (input.task_type !== undefined && input.task_type !== taskType) {
    throw new ApiError('Task type cannot be changed', 400);
  }
  const isOneOff = taskType === 'one_off';
  const members = await listMembers(householdId);
  const baseContext: AssignmentContext = {
    householdId,
    today: londonToday(),
    members,
    templates: [],
    instances: [],
  };

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.room_id !== undefined) patch.room_id = input.room_id;
  if (input.description !== undefined) patch.description = input.description;

  if (!isOneOff) {
    if (input.frequency !== undefined) patch.frequency = input.frequency;
    if (input.frequency_days !== undefined) patch.frequency_days = input.frequency_days;
  }
  if (input.estimated_minutes !== undefined) {
    patch.estimated_minutes = input.estimated_minutes;
  }
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.is_active !== undefined) patch.is_active = input.is_active;

  const modeProvided = input.assignment_mode !== undefined;
  const modeChanged =
    modeProvided && input.assignment_mode !== current.assignment_mode;
  if (modeProvided) {
    patch.assignment_mode = input.assignment_mode;
    if (input.assignment_mode !== 'fixed') patch.fixed_assignee_id = null;
    if (input.assignment_mode !== 'rotate') patch.rotation_member_ids = null;
  }

  const nextMode = (input.assignment_mode ??
    current.assignment_mode ??
    'balanced') as AssignmentMode;

  const fixedProvided = input.fixed_assignee_id !== undefined;
  let fixedChanged = false;
  if (fixedProvided || nextMode === 'fixed') {
    const fixed =
      fixedProvided
        ? validateMember(baseContext, input.fixed_assignee_id)
        : validateMember(baseContext, current.fixed_assignee_id);
    if (nextMode === 'fixed' && !fixed) {
      throw new ApiError('Choose a household member for this chore.', 400);
    }
    fixedChanged =
      fixedProvided && (fixed ?? null) !== (current.fixed_assignee_id ?? null);
    if (fixedProvided) patch.fixed_assignee_id = fixed;
  }

  const rotationProvided = input.rotation_member_ids !== undefined;
  let rotationChanged = false;
  if (rotationProvided) {
    const nextRotation = rotationIdsFor(baseContext, input.rotation_member_ids);
    rotationChanged =
      JSON.stringify(nextRotation) !==
      JSON.stringify(current.rotation_member_ids ?? null);
    patch.rotation_member_ids = nextRotation;
  }

  const scheduleChanged =
    !isOneOff &&
    ((input.frequency !== undefined && input.frequency !== current.frequency) ||
      (input.frequency_days !== undefined &&
        input.frequency_days !== current.frequency_days));

  if (scheduleChanged) {
    patch.next_due_date = calculateNextDueDate(
      input.frequency ?? current.frequency,
      input.frequency_days ?? current.frequency_days,
      londonToday()
    );
  }

  if (isOneOff && input.due_date !== undefined && input.due_date !== null) {
    patch.next_due_date = input.due_date;
  }

  const assignmentChanged = modeChanged || fixedChanged || rotationChanged;
  const activeChanged =
    input.is_active !== undefined && input.is_active !== current.is_active;

  await ref.update(patch);
  let updated = asTemplate(templateId, (await ref.get()).data() as Record<string, unknown>);
  const context = await assignmentContext(householdId);
  const pending = context.instances.filter(
    (instance) => instance.template_id === templateId && instance.status === 'pending'
  );

  if (isOneOff) {
    for (const instance of pending) {
      const changes: Record<string, unknown> = {};
      if (input.due_date !== undefined && input.due_date !== null) {
        changes.due_date = input.due_date;
      }
      if (assignmentChanged) {
        const choice = chooseAssignee(context, updated);
        changes.assigned_to = choice.assignee;
        changes.assigned_at = choice.assignee ? new Date().toISOString() : null;
        changes.assigned_by = null;
        if (choice.rotationCursor) {
          await ref.update({ rotation_last_assignee_id: choice.rotationCursor });
          updated.rotation_last_assignee_id = choice.rotationCursor;
        }
        instance.assigned_to = choice.assignee;
      }
      if (Object.keys(changes).length > 0) {
        await instanceRef(householdId, instance.id).update(changes);
      }
    }
    return updated;
  }

  const today = londonToday();

  if (scheduleChanged || activeChanged) {
    const future = context.instances.filter(
      (instance) =>
        instance.template_id === templateId &&
        instance.status === 'pending' &&
        instance.due_date > today
    );
    await Promise.all(future.map((instance) => instanceRef(householdId, instance.id).delete()));

    const fresh = await assignmentContext(householdId);
    const stillPending = fresh.instances.some(
      (instance) => instance.template_id === templateId && instance.status === 'pending'
    );
    if (updated.is_active && !stillPending) {
      const due =
        updated.next_due_date && updated.next_due_date >= today
          ? updated.next_due_date
          : today;
      await createInstance(fresh, updated, due);
    }
    return updated;
  }

  if (assignmentChanged) {
    for (const instance of pending) {
      const choice = chooseAssignee(context, updated);
      await instanceRef(householdId, instance.id).update({
        assigned_to: choice.assignee,
        assigned_at: choice.assignee ? new Date().toISOString() : null,
        assigned_by: null,
      });
      if (choice.rotationCursor) {
        await ref.update({ rotation_last_assignee_id: choice.rotationCursor });
        updated.rotation_last_assignee_id = choice.rotationCursor;
      }
      instance.assigned_to = choice.assignee;
      instance.assigned_at = choice.assignee ? new Date().toISOString() : null;
    }
  }

  return updated;
}

export async function deleteChoreTemplate(
  householdId: string,
  templateId: string
): Promise<void> {
  const ref = householdCollection(householdId, 'choreTemplates').doc(templateId);
  if (!(await ref.get()).exists) throw new ApiError('Chore template not found', 404);

  const instances = await householdCollection(householdId, 'choreInstances').get();
  const pending = instances.docs.filter(
    (doc) => doc.data().template_id === templateId && doc.data().status === 'pending'
  );
  await Promise.all(pending.map((doc) => doc.ref.delete()));
  await ref.delete();
}

export async function listChoreInstances(
  householdId: string,
  filter: ChoreInstanceFilter
): Promise<ChoreInstance[]> {
  const [instancesResult, templates, rooms] = await Promise.all([
    householdCollection(householdId, 'choreInstances').get(),
    listChoreTemplates(householdId),
    listRooms(householdId),
  ]);
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const roomNames = new Map(rooms.map((room) => [room.id, room.name]));

  return instancesResult.docs
    .map((doc) => {
      const data = doc.data();
      const template = templateMap.get(data.template_id);
      return {
        id: doc.id,
        ...(data as Omit<ChoreInstance, 'id'>),
        task_type: template?.task_type ?? data.task_type ?? 'recurring',
        assignment_mode: template?.assignment_mode,
        template_name: template?.name,
        room_name: template?.room_id ? roomNames.get(template.room_id) : undefined,
      };
    })
    .filter((instance) => {
      if (filter.status && instance.status !== filter.status) return false;
      if (filter.due_date && instance.due_date !== filter.due_date) return false;
      if (filter.due_before && instance.due_date > filter.due_before) return false;
      if (filter.task_type && instance.task_type !== filter.task_type) return false;
      if (filter.unassigned === 'true' && instance.assigned_to !== null) return false;
      if (filter.unassigned === 'false' && instance.assigned_to === null) return false;
      if (
        filter.assigned_to &&
        instance.assigned_to !== filter.assigned_to
      ) {
        return false;
      }
      return true;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

async function getInstance(
  householdId: string,
  id: string
): Promise<{ ref: ReturnType<typeof instanceRef>; instance: ChoreInstance }> {
  const ref = instanceRef(householdId, id);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Chore instance not found', 404);
  return { ref, instance: asInstance(doc.id, doc.data() as Record<string, unknown>) };
}

export interface CompletionResult {
  xp_awarded: number;
  on_time: boolean;
  streak_current: number;
}

export async function completeChore(
  householdId: string,
  instanceIdValue: string,
  userId: string,
  notes?: string | null
): Promise<CompletionResult> {
  const { ref, instance } = await getInstance(householdId, instanceIdValue);
  if (instance.status !== 'pending') {
    throw new ApiError('This chore is already closed', 409);
  }

  const templateRef = householdCollection(householdId, 'choreTemplates').doc(
    instance.template_id
  );
  const templateDoc = await templateRef.get();
  if (!templateDoc.exists) throw new ApiError('Chore template not found', 404);
  const template = asTemplate(
    templateDoc.id,
    templateDoc.data() as Record<string, unknown>
  );
  const isOneOff = template.task_type === 'one_off';

  const today = londonToday();
  const dueDate = instance.due_date;
  const onTime = today <= dueDate;
  const xpAwarded = completionXp(template.estimated_minutes, onTime);
  const completedAt = new Date().toISOString();
  const nextDue = isOneOff
    ? null
    : calculateNextDueAfter(
        template.frequency,
        template.frequency_days,
        dueDate,
        today
      );

  await dbAdmin().runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.status !== 'pending') {
      throw new ApiError('This chore is already closed', 409);
    }
    tx.update(ref, {
      status: 'completed',
      completed_by: userId,
      completed_at: completedAt,
      xp_awarded: xpAwarded,
      on_time: onTime,
      ...(notes ? { notes } : {}),
    });
    tx.update(
      templateRef,
      isOneOff
        ? { is_active: false, next_due_date: null }
        : { next_due_date: nextDue }
    );
  });

  if (!isOneOff && nextDue && template.is_active) {
    try {
      const context = await assignmentContext(householdId);
      await createInstance(context, template, nextDue);
    } catch (error) {
      // The occurrence is already closed. Cron will retry the next instance.
      console.error(`Could not create the next chore instance for ${template.id}`, error);
    }
  }

  const history = await householdCollection(householdId, 'choreInstances')
    .where('template_id', '==', template.id)
    .get();
  const streak = templateStreak(
    history.docs.map((doc) => doc.data() as ChoreInstance),
    today
  );

  return {
    xp_awarded: xpAwarded,
    on_time: onTime,
    streak_current: streak.current,
  };
}

export async function skipChore(
  householdId: string,
  instanceIdValue: string,
  notes?: string | null
): Promise<void> {
  const { ref, instance } = await getInstance(householdId, instanceIdValue);
  if (instance.status !== 'pending') {
    throw new ApiError('This chore is already closed', 409);
  }

  const templateRef = householdCollection(householdId, 'choreTemplates').doc(
    instance.template_id
  );
  const templateDoc = await templateRef.get();
  if (!templateDoc.exists) throw new ApiError('Chore template not found', 404);
  const template = asTemplate(
    templateDoc.id,
    templateDoc.data() as Record<string, unknown>
  );
  const isOneOff = template.task_type === 'one_off';
  const today = londonToday();
  const nextDue = isOneOff
    ? null
    : calculateNextDueAfter(
        template.frequency,
        template.frequency_days,
        instance.due_date,
        today
      );

  await dbAdmin().runTransaction(async (tx) => {
    const fresh = await tx.get(ref);
    if (fresh.data()?.status !== 'pending') {
      throw new ApiError('This chore is already closed', 409);
    }
    tx.update(ref, {
      status: 'skipped',
      ...(notes ? { notes } : {}),
    });
    tx.update(
      templateRef,
      isOneOff
        ? { is_active: false, next_due_date: null }
        : { next_due_date: nextDue }
    );
  });

  if (!isOneOff && nextDue && template.is_active) {
    try {
      const context = await assignmentContext(householdId);
      await createInstance(context, template, nextDue);
    } catch (error) {
      // The occurrence is already closed. Cron will retry the next instance.
      console.error(`Could not create the next chore instance for ${template.id}`, error);
    }
  }
}

export async function assignChore(
  householdId: string,
  instanceIdValue: string,
  assignedTo: string | null,
  assignedBy: string | null = null
): Promise<{
  assigned_to: string | null;
  previously_assigned_to: string | null;
  due_date: string;
  template_name: string;
}> {
  const ref = instanceRef(householdId, instanceIdValue);
  const doc = await ref.get();
  if (!doc.exists) {
    throw new ApiError('Chore instance not found', 404);
  }
  const previouslyAssignedTo = (doc.data()?.assigned_to ?? null) as string | null;

  if (assignedTo) {
    const members = await listMembers(householdId);
    if (!members.some((member) => member.id === assignedTo)) {
      throw new ApiError('Assignee is not in this household', 400);
    }
  }

  await ref.update({
    assigned_to: assignedTo,
    assigned_at: assignedTo ? new Date().toISOString() : null,
    assigned_by: assignedBy,
  });

  const templateId = String(doc.data()?.template_id);
  const template = await householdCollection(householdId, 'choreTemplates')
    .doc(templateId)
    .get();

  return {
    assigned_to: assignedTo,
    previously_assigned_to: previouslyAssignedTo,
    due_date: String(doc.data()?.due_date),
    template_name: String(template.data()?.name ?? 'Task'),
  };
}

export function balanceFromData(
  instances: ChoreInstance[],
  templates: ChoreTemplate[],
  members: User[],
  today: string
): { members: MemberBalance[]; unassigned: UnassignedBalance } {
  const minutesByTemplate = new Map(
    templates.map((template) => [template.id, estimatedMinutes(template)])
  );
  const from = addDays(today, -6);

  const rows: MemberBalance[] = members.map((member) => ({
    user_id: member.id,
    name: member.name,
    open_minutes: 0,
    done_minutes: 0,
    open_chores: 0,
    overdue_chores: 0,
  }));
  const byId = new Map(rows.map((row) => [row.user_id, row]));
  const unassigned: UnassignedBalance = { open_chores: 0, open_minutes: 0 };

  instances.forEach((instance) => {
    const minutes = minutesByTemplate.get(instance.template_id) ?? 15;

    if (instance.status === 'pending') {
      if (instance.assigned_to) {
        const row = byId.get(instance.assigned_to);
        if (row) {
          row.open_minutes += minutes;
          row.open_chores += 1;
          if (instance.due_date < today) row.overdue_chores += 1;
        }
      } else {
        unassigned.open_chores += 1;
        unassigned.open_minutes += minutes;
      }
      return;
    }

    if (instance.status === 'completed' && instance.completed_by && instance.completed_at) {
      const completedDate = londonDateString(new Date(instance.completed_at));
      if (completedDate >= from && completedDate <= today) {
        const row = byId.get(instance.completed_by);
        if (row) row.done_minutes += minutes;
      }
    }
  });

  return {
    members: rows.sort((a, b) => a.name.localeCompare(b.name)),
    unassigned,
  };
}

export async function generateDailyChores(): Promise<number> {
  const today = londonToday();
  const households = await dbAdmin().collection('households').get();
  let created = 0;

  for (const household of households.docs) {
    const householdId = household.id;
    try {
      const context = await assignmentContext(householdId);
      const templates = context.templates.filter(
        (template) => template.is_active && template.task_type !== 'one_off'
      );

      for (const template of templates) {
        const hasPending = context.instances.some(
          (instance) =>
            instance.template_id === template.id && instance.status === 'pending'
        );
        if (hasPending) continue;

        const due =
          template.next_due_date && template.next_due_date >= today
            ? template.next_due_date
            : today;
        const didCreate = await createInstance(context, template, due);
        if (didCreate) {
          if (template.next_due_date !== due) {
            await householdCollection(householdId, 'choreTemplates')
              .doc(template.id)
              .update({ next_due_date: due });
          }
          created += 1;
        }
      }
    } catch (error) {
      console.error(`Could not generate chores for household ${householdId}`, error);
    }
  }

  return created;
}
