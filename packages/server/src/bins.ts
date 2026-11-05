import { randomUUID } from 'node:crypto';

import type { BinAction, BinException, BinSchedule } from '@chores/domain';
import {
  BIN_PUT_OUT_XP,
  addDays,
  collectionDates,
  londonToday,
  nextCollection,
} from '@chores/domain';

import { householdCollection } from './households';
import { ApiError } from './http';
import { listMembers } from './users';

export type BinScheduleInput = {
  bin_type: string;
  name: string;
  colour?: string;
  collection_day: number;
  frequency?: string;
  start_date: string;
  reminder_offset_hours?: number;
};

function scheduleFromDoc(id: string, data: Record<string, unknown>): BinSchedule {
  return { id, ...(data as unknown as Omit<BinSchedule, 'id'>) };
}

function exceptionFromDoc(id: string, data: Record<string, unknown>): BinException {
  return { id, ...(data as unknown as Omit<BinException, 'id'>) };
}

function actionFromDoc(id: string, data: Record<string, unknown>): BinAction {
  return { id, ...(data as unknown as Omit<BinAction, 'id'>) };
}

export async function binActionsForDate(
  householdId: string,
  collectionDate: string
): Promise<BinAction[]> {
  const result = await householdCollection(householdId, 'binActions').get();
  return result.docs
    .map((doc) => actionFromDoc(doc.id, doc.data()))
    .filter((action) => action.collection_date === collectionDate);
}

export async function listBinSchedules(householdId: string): Promise<BinSchedule[]> {
  const [schedules, exceptions] = await Promise.all([
    householdCollection(householdId, 'binSchedules').get(),
    listBinExceptions(householdId),
  ]);
  const grouped = new Map<string, BinException[]>();
  exceptions.forEach((exception) => {
    grouped.set(exception.schedule_id, [...(grouped.get(exception.schedule_id) ?? []), exception]);
  });

  return schedules.docs
    .map((doc) => {
      const schedule = scheduleFromDoc(doc.id, doc.data());
      return {
        ...schedule,
        next_collection:
          nextCollection(schedule, londonToday(), grouped.get(schedule.id) ?? []) ?? undefined,
      };
    })
    .sort((a, b) => a.collection_day - b.collection_day);
}

export async function createBinSchedule(
  householdId: string,
  input: BinScheduleInput
): Promise<BinSchedule> {
  const id = randomUUID();
  const schedule = {
    household_id: householdId,
    bin_type: input.bin_type,
    name: input.name.trim(),
    colour: input.colour ?? 'black',
    collection_day: input.collection_day,
    frequency: input.frequency ?? 'weekly',
    start_date: input.start_date,
    reminder_offset_hours: input.reminder_offset_hours ?? 15,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'binSchedules').doc(id).set(schedule);
  return {
    id,
    ...schedule,
    next_collection: nextCollection(schedule, londonToday()) ?? undefined,
  };
}

export async function listBinExceptions(householdId: string): Promise<BinException[]> {
  const result = await householdCollection(householdId, 'binExceptions')
    .orderBy('original_date', 'asc')
    .get();
  return result.docs.map((doc) => exceptionFromDoc(doc.id, doc.data()));
}

export async function createBinException(
  householdId: string,
  input: {
    schedule_id: string;
    original_date: string;
    action: 'skip' | 'move';
    moved_to_date?: string | null;
    reason?: string | null;
  }
): Promise<BinException> {
  const schedule = await householdCollection(householdId, 'binSchedules')
    .doc(input.schedule_id)
    .get();
  if (!schedule.exists) throw new ApiError('Bin schedule not found', 404);
  if (input.action === 'move' && !input.moved_to_date) {
    throw new ApiError('A moved collection needs a new date', 400);
  }

  const id = randomUUID();
  const exception = {
    schedule_id: input.schedule_id,
    original_date: input.original_date,
    action: input.action,
    moved_to_date: input.moved_to_date ?? null,
    reason: input.reason ?? null,
  };
  await householdCollection(householdId, 'binExceptions').doc(id).set(exception);
  return { id, ...exception };
}

export async function deleteBinException(
  householdId: string,
  exceptionId: string
): Promise<void> {
  const ref = householdCollection(householdId, 'binExceptions').doc(exceptionId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Bin exception not found', 404);
  await ref.delete();
}

export async function binsTonight(householdId: string): Promise<BinSchedule[]> {
  const today = londonToday();
  const tomorrow = addDays(today, 1);
  const [schedules, actions, members] = await Promise.all([
    listBinSchedules(householdId),
    binActionsForDate(householdId, tomorrow),
    listMembers(householdId),
  ]);
  const memberNames = new Map(members.map((member) => [member.id, member.name]));
  const actionBySchedule = new Map(
    actions.map((action) => [action.schedule_id, action])
  );

  return schedules
    .filter((schedule) => schedule.is_active && schedule.next_collection === tomorrow)
    .map((schedule) => {
      const action = actionBySchedule.get(schedule.id);
      return {
        ...schedule,
        next_collection: tomorrow,
        put_out_at: action?.created_at ?? null,
        put_out_by: action?.member_id ?? null,
        put_out_by_name: action ? memberNames.get(action.member_id) ?? null : null,
      };
    });
}

export async function markBinsOut(
  householdId: string,
  userId: string
): Promise<BinAction[]> {
  const schedules = await binsTonight(householdId);
  if (schedules.length === 0) {
    throw new ApiError('There are no bins due tonight', 400);
  }

  const collectionDate = schedules[0].next_collection!;
  const actions: BinAction[] = [];

  for (const schedule of schedules) {
    const id = `${collectionDate}_${schedule.id}`;
    const ref = householdCollection(householdId, 'binActions').doc(id);
    const existing = await ref.get();
    if (existing.exists) {
      actions.push(actionFromDoc(existing.id, existing.data() as Record<string, unknown>));
      continue;
    }

    const action = {
      schedule_id: schedule.id,
      collection_date: collectionDate,
      member_id: userId,
      created_at: new Date().toISOString(),
      xp_awarded: BIN_PUT_OUT_XP,
    };
    try {
      await ref.create(action);
      actions.push({ id, ...action });
    } catch (error) {
      if ((error as { code?: number }).code !== 6) throw error;
    }
  }

  return actions;
}

export async function upcomingBinDates(
  householdId: string,
  weeks = 8
): Promise<{ schedule: BinSchedule; dates: string[] }[]> {
  const [schedules, exceptions] = await Promise.all([
    householdCollection(householdId, 'binSchedules').get(),
    listBinExceptions(householdId),
  ]);
  const grouped = new Map<string, BinException[]>();
  exceptions.forEach((exception) => {
    grouped.set(exception.schedule_id, [...(grouped.get(exception.schedule_id) ?? []), exception]);
  });
  const today = londonToday();

  return schedules.docs
    .map((doc) => scheduleFromDoc(doc.id, doc.data()))
    .filter((schedule) => schedule.is_active)
    .map((schedule) => ({
      schedule,
      dates: collectionDates(schedule, today, grouped.get(schedule.id) ?? [], weeks),
    }));
}
