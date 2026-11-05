import { randomUUID } from 'node:crypto';

import type { ChoreInstance, ChoreTemplate, User } from '@chores/domain';
import {
  calculateNextDueDate,
  completionXp,
  londonToday,
  pickFairAssignee,
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
  frequency?: string;
  frequency_days?: number | null;
  estimated_minutes?: number | null;
  priority?: string;
};

function asTemplate(id: string, data: Record<string, unknown>): ChoreTemplate {
  return { id, ...(data as unknown as Omit<ChoreTemplate, 'id'>) };
}

function instanceId(templateId: string, dueDate: string): string {
  return `${templateId}_${dueDate}`;
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

async function pendingCounts(householdId: string): Promise<Record<string, number>> {
  const result = await householdCollection(householdId, 'choreInstances')
    .where('status', '==', 'pending')
    .get();
  const counts: Record<string, number> = {};
  result.docs.forEach((doc) => {
    const assigned = doc.data().assigned_to;
    if (assigned) counts[assigned] = (counts[assigned] ?? 0) + 1;
  });
  return counts;
}

export async function fairAssignee(householdId: string): Promise<string | null> {
  const members = await listMembers(householdId);
  return pickFairAssignee(members, await pendingCounts(householdId));
}

async function createFutureInstance(
  householdId: string,
  template: ChoreTemplate,
  dueDate: string
): Promise<boolean> {
  const ref = householdCollection(householdId, 'choreInstances').doc(
    instanceId(template.id, dueDate)
  );
  const existing = await ref.get();
  if (existing.exists) return false;

  try {
    await ref.create({
      template_id: template.id,
      household_id: householdId,
      assigned_to: await fairAssignee(householdId),
      completed_by: null,
      due_date: dueDate,
      completed_at: null,
      status: 'pending',
      notes: null,
      created_at: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    // Concurrent completion already created the next instance.
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }
}

export async function createChoreTemplate(
  householdId: string,
  input: ChoreTemplateInput
): Promise<ChoreTemplate> {
  if (input.room_id) {
    const room = await householdCollection(householdId, 'rooms').doc(input.room_id).get();
    if (!room.exists) throw new ApiError('Room not found', 404);
  }

  const today = londonToday();
  const id = randomUUID();
  const template = {
    household_id: householdId,
    room_id: input.room_id ?? null,
    name: input.name.trim(),
    description: input.description ?? null,
    frequency: input.frequency ?? 'weekly',
    frequency_days: input.frequency_days ?? null,
    estimated_minutes: input.estimated_minutes ?? 15,
    priority: input.priority ?? 'medium',
    is_active: true,
    next_due_date: today,
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'choreTemplates').doc(id).set(template);

  await householdCollection(householdId, 'choreInstances')
    .doc(instanceId(id, today))
    .set({
      template_id: id,
      household_id: householdId,
      assigned_to: await fairAssignee(householdId),
      completed_by: null,
      due_date: today,
      completed_at: null,
      status: 'pending',
      notes: null,
      created_at: new Date().toISOString(),
    });

  return asTemplate(id, template);
}

export async function listChoreInstances(
  householdId: string,
  filter: { status?: string; due_date?: string; due_before?: string }
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
        template_name: template?.name,
        room_name: template?.room_id ? roomNames.get(template.room_id) : undefined,
      };
    })
    .filter((instance) => {
      if (filter.status && instance.status !== filter.status) return false;
      if (filter.due_date && instance.due_date !== filter.due_date) return false;
      if (filter.due_before && instance.due_date > filter.due_before) return false;
      return true;
    })
    .sort((a, b) => a.due_date.localeCompare(b.due_date));
}

async function instanceRef(householdId: string, instanceIdValue: string) {
  const ref = householdCollection(householdId, 'choreInstances').doc(instanceIdValue);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Chore instance not found', 404);
  return ref;
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
  const ref = await instanceRef(householdId, instanceIdValue);
  const current = await ref.get();
  if (current.data()?.status !== 'pending') {
    throw new ApiError('This chore is already closed', 409);
  }

  const templateId = String(current.data()?.template_id);
  const templateRef = householdCollection(householdId, 'choreTemplates').doc(templateId);
  const templateDoc = await templateRef.get();
  if (!templateDoc.exists) throw new ApiError('Chore template not found', 404);
  const template = asTemplate(templateDoc.id, templateDoc.data() as Record<string, unknown>);

  const today = londonToday();
  const dueDate = String(current.data()?.due_date);
  const onTime = today <= dueDate;
  const xpAwarded = completionXp(template.estimated_minutes, onTime);
  const completedAt = new Date().toISOString();
  const nextDue = calculateNextDueDate(
    template.frequency,
    template.frequency_days,
    today
  );

  const transaction = dbAdmin().runTransaction(async (tx) => {
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
    tx.update(templateRef, { next_due_date: nextDue });
  });
  await transaction;
  await createFutureInstance(householdId, template, nextDue);

  const history = await householdCollection(householdId, 'choreInstances')
    .where('template_id', '==', templateId)
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
  const ref = await instanceRef(householdId, instanceIdValue);
  const current = await ref.get();
  if (current.data()?.status !== 'pending') {
    throw new ApiError('This chore is already closed', 409);
  }

  const templateId = String(current.data()?.template_id);
  const templateRef = householdCollection(householdId, 'choreTemplates').doc(templateId);
  const templateDoc = await templateRef.get();
  if (!templateDoc.exists) throw new ApiError('Chore template not found', 404);
  const template = asTemplate(templateDoc.id, templateDoc.data() as Record<string, unknown>);
  const nextDue = calculateNextDueDate(
    template.frequency,
    template.frequency_days,
    londonToday()
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
    tx.update(templateRef, { next_due_date: nextDue });
  });
  await createFutureInstance(householdId, template, nextDue);
}

export async function assignChore(
  householdId: string,
  instanceIdValue: string,
  assignedTo: string | null
): Promise<void> {
  const ref = await instanceRef(householdId, instanceIdValue);
  if (assignedTo) {
    const members = await listMembers(householdId);
    if (!members.some((member: User) => member.id === assignedTo)) {
      throw new ApiError('Assignee is not in this household', 400);
    }
  }
  await ref.update({ assigned_to: assignedTo });
}

export async function generateDailyChores(): Promise<number> {
  const today = londonToday();
  const households = await dbAdmin().collection('households').get();
  let created = 0;

  for (const household of households.docs) {
    const householdId = household.id;
    const templates = await listChoreTemplates(householdId);
    const pending = await householdCollection(householdId, 'choreInstances')
      .where('status', '==', 'pending')
      .get();

    for (const template of templates.filter((item) => item.is_active)) {
      const hasPending = pending.docs.some(
        (doc) => doc.data().template_id === template.id
      );
      if (hasPending) continue;

      const due = template.next_due_date && template.next_due_date >= today
        ? template.next_due_date
        : today;
      const didCreate = await createFutureInstance(householdId, template, due);
      if (didCreate) {
        if (template.next_due_date !== due) {
          await householdCollection(householdId, 'choreTemplates')
            .doc(template.id)
            .update({ next_due_date: due });
        }
        created += 1;
      }
    }
  }
  return created;
}
