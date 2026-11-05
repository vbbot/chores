import { randomUUID } from 'node:crypto';

import type { ChoreInstance, ChoreTemplate, User } from '@chores/domain';
import { londonToday, pickFairAssignee } from '@chores/domain';

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

export async function listChoreTemplates(householdId: string): Promise<ChoreTemplate[]> {
  const result = await householdCollection(householdId, 'choreTemplates').get();
  return result.docs
    .map((doc) => asTemplate(doc.id, doc.data()))
    .sort((a, b) => a.name.localeCompare(b.name));
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

export async function createChoreTemplate(
  householdId: string,
  input: ChoreTemplateInput
): Promise<ChoreTemplate> {
  if (input.room_id) {
    const room = await householdCollection(householdId, 'rooms').doc(input.room_id).get();
    if (!room.exists) throw new ApiError('Room not found', 404);
  }

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
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'choreTemplates').doc(id).set(template);

  await householdCollection(householdId, 'choreInstances').doc(randomUUID()).set({
    template_id: id,
    household_id: householdId,
    assigned_to: await fairAssignee(householdId),
    completed_by: null,
    due_date: londonToday(),
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

async function instanceRef(householdId: string, instanceId: string) {
  const ref = householdCollection(householdId, 'choreInstances').doc(instanceId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Chore instance not found', 404);
  return ref;
}

export async function completeChore(
  householdId: string,
  instanceId: string,
  userId: string,
  notes?: string | null
): Promise<void> {
  const ref = await instanceRef(householdId, instanceId);
  await ref.update({
    status: 'completed',
    completed_by: userId,
    completed_at: new Date().toISOString(),
    ...(notes ? { notes } : {}),
  });
}

export async function skipChore(
  householdId: string,
  instanceId: string,
  notes?: string | null
): Promise<void> {
  const ref = await instanceRef(householdId, instanceId);
  await ref.update({
    status: 'skipped',
    ...(notes ? { notes } : {}),
  });
}

export async function assignChore(
  householdId: string,
  instanceId: string,
  assignedTo: string | null
): Promise<void> {
  const ref = await instanceRef(householdId, instanceId);
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
      const hasUpcoming = pending.docs.some(
        (doc) =>
          doc.data().template_id === template.id &&
          String(doc.data().due_date) >= today
      );
      if (hasUpcoming) continue;

      await householdCollection(householdId, 'choreInstances').doc(randomUUID()).set({
        template_id: template.id,
        household_id: householdId,
        assigned_to: await fairAssignee(householdId),
        completed_by: null,
        due_date: today,
        completed_at: null,
        status: 'pending',
        notes: null,
        created_at: new Date().toISOString(),
      });
      created += 1;
    }
  }
  return created;
}
