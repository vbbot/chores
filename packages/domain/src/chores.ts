import { addDays } from './dates';
import { addMonths } from './bills';
import type { User } from './types';

export function calculateNextDueDate(
  frequency: string,
  frequencyDays: number | null,
  fromDate: string
): string {
  switch (frequency) {
    case 'daily':
      return addDays(fromDate, 1);
    case 'every_n_days':
      return addDays(fromDate, frequencyDays ?? 3);
    case 'weekly':
      return addDays(fromDate, 7);
    case 'biweekly':
      return addDays(fromDate, 14);
    case 'monthly':
      return addMonths(fromDate, 1);
    case 'quarterly':
      return addMonths(fromDate, 3);
    case 'yearly':
      return addMonths(fromDate, 12);
    default:
      return addDays(fromDate, 7);
  }
}

/**
 * Advances from the scheduled date, not from today.
 * Missed occurrences are skipped so late completion does not drift the cadence.
 */
export function calculateNextDueAfter(
  frequency: string,
  frequencyDays: number | null,
  fromDate: string,
  today: string
): string {
  let next = calculateNextDueDate(frequency, frequencyDays, fromDate);
  let guard = 0;
  while (next <= today && guard < 800) {
    next = calculateNextDueDate(frequency, frequencyDays, next);
    guard += 1;
  }
  return next;
}

export function frequencyLabel(frequency: string, frequencyDays: number | null): string {
  if (frequency === 'every_n_days') {
    return `Every ${frequencyDays ?? 3} days`;
  }
  const labels: Record<string, string> = {
    daily: 'Daily',
    weekly: 'Weekly',
    biweekly: 'Fortnightly',
    monthly: 'Monthly',
    quarterly: 'Quarterly',
    yearly: 'Yearly',
  };
  return labels[frequency] ?? frequency;
}

/** Picks the member with the fewest pending chores. */
export function pickFairAssignee(
  members: Pick<User, 'id'>[],
  pendingCounts: Record<string, number>
): string | null {
  if (members.length === 0) return null;
  return [...members].sort(
    (a, b) => (pendingCounts[a.id] ?? 0) - (pendingCounts[b.id] ?? 0)
  )[0].id;
}
