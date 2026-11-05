import { randomUUID } from 'node:crypto';

import type { BinException, BinSchedule } from '@chores/domain';
import { addDays, collectionDates, londonToday, nextCollection } from '@chores/domain';

import { householdCollection } from './households';
import { ApiError } from './http';

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
  const schedules = await listBinSchedules(householdId);
  return schedules
    .filter((schedule) => schedule.is_active && schedule.next_collection === tomorrow)
    .map((schedule) => ({ ...schedule, next_collection: tomorrow }));
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
