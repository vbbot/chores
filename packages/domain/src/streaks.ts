import { londonDateString } from './dates';
import type { ChoreInstance } from './types';

export interface StreakResult {
  current: number;
  best: number;
}

function isOnTime(instance: ChoreInstance): boolean {
  if (typeof instance.on_time === 'boolean') return instance.on_time;
  if (!instance.completed_at) return false;
  return londonDateString(new Date(instance.completed_at)) <= instance.due_date;
}

/**
 * Streaks count consecutive on-time completions of scheduled occurrences.
 * A pending instance due today does not break the streak until the day ends.
 */
export function templateStreak(
  instances: Pick<ChoreInstance, 'due_date' | 'status' | 'on_time' | 'completed_at'>[],
  today: string
): StreakResult {
  const byDue = new Map<string, (typeof instances)[number]>();
  instances.forEach((instance) => byDue.set(instance.due_date, instance));

  const due = Array.from(byDue.values())
    .filter((instance) => instance.due_date <= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date));

  let best = 0;
  let run = 0;
  for (const instance of due) {
    if (instance.status === 'completed' && isOnTime(instance as ChoreInstance)) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }

  let current = 0;
  let index = due.length - 1;
  if (due[index]?.due_date === today && due[index]?.status === 'pending') {
    index -= 1;
  }
  while (index >= 0) {
    const instance = due[index];
    if (instance.status !== 'completed' || !isOnTime(instance as ChoreInstance)) break;
    current += 1;
    index -= 1;
  }

  return { current, best };
}

export function lastSevenDays(today: string): string[] {
  const result: string[] = [];
  const date = new Date(`${today}T12:00:00Z`);
  for (let offset = 6; offset >= 0; offset -= 1) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() - offset);
    result.push(copy.toISOString().slice(0, 10));
  }
  return result;
}
