import { addDays } from './dates';
import type { User } from './types';

export function calculateNextDueDate(
  frequency: string,
  frequencyDays: number | null,
  fromDate: string
): string {
  switch (frequency) {
    case 'daily':
      return fromDate;
    case 'every_n_days':
      return addDays(fromDate, frequencyDays ?? 3);
    case 'weekly':
      return addDays(fromDate, 7);
    case 'biweekly':
      return addDays(fromDate, 14);
    case 'monthly':
      return addDays(fromDate, 30);
    case 'quarterly':
      return addDays(fromDate, 90);
    case 'yearly':
      return addDays(fromDate, 365);
    default:
      return addDays(fromDate, 7);
  }
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
