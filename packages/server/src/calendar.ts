import { randomUUID } from 'node:crypto';

import type { CalendarEvent } from '@chores/domain';

import { householdCollection } from './households';
import { ApiError } from './http';

function eventFromDoc(id: string, data: Record<string, unknown>): CalendarEvent {
  return { id, ...(data as unknown as Omit<CalendarEvent, 'id'>) };
}

function normalise(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new ApiError('Invalid event time', 400);
  return date.toISOString();
}

export async function listCalendarEvents(householdId: string): Promise<CalendarEvent[]> {
  const result = await householdCollection(householdId, 'calendarEvents')
    .orderBy('start_time', 'asc')
    .get();
  return result.docs.map((doc) => eventFromDoc(doc.id, doc.data()));
}

export async function createCalendarEvent(
  householdId: string,
  userId: string,
  input: {
    title: string;
    description?: string | null;
    start_time: string;
    end_time?: string | null;
    all_day?: boolean;
    assigned_to?: string | null;
    recurrence_rule?: string | null;
    color?: string | null;
    category?: string | null;
  }
): Promise<CalendarEvent> {
  const id = randomUUID();
  const event = {
    household_id: householdId,
    created_by: userId,
    assigned_to: input.assigned_to ?? null,
    title: input.title.trim(),
    description: input.description ?? null,
    start_time: normalise(input.start_time)!,
    end_time: normalise(input.end_time),
    all_day: input.all_day ?? false,
    recurrence_rule: input.recurrence_rule ?? null,
    color: input.color ?? null,
    category: input.category ?? null,
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'calendarEvents').doc(id).set(event);
  return { id, ...event };
}

export async function deleteCalendarEvent(
  householdId: string,
  eventId: string
): Promise<void> {
  const ref = householdCollection(householdId, 'calendarEvents').doc(eventId);
  if (!(await ref.get()).exists) throw new ApiError('Event not found', 404);
  await ref.delete();
}
