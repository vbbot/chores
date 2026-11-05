const LONDON = 'Europe/London';

/** ISO date (YYYY-MM-DD) in the household timezone. */
export function londonDateString(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: LONDON,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

export function londonToday(): string {
  return londonDateString();
}

/** Short UK date for an ISO date or timestamp. */
export function formatUkDate(value: string): string {
  const date = value.length <= 10 ? new Date(`${value}T12:00:00Z`) : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: LONDON,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function dueLabel(dueDate: string, today: string): string {
  if (dueDate < today) return `Overdue since ${formatUkDate(dueDate)}`;
  if (dueDate === today) return 'Due today';
  return `Due ${formatUkDate(dueDate)}`;
}

/** Parses a date-only ISO string at noon UTC to avoid DST edge cases. */
export function parseIsoDate(value: string): Date {
  return new Date(`${value.slice(0, 10)}T12:00:00Z`);
}

export function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function addDays(value: string, days: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

/** Monday = 0 ... Sunday = 6. */
export function weekdayIndex(value: string): number {
  return (parseIsoDate(value).getUTCDay() + 6) % 7;
}

export function daysBetween(from: string, to: string): number {
  return Math.round(
    (parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / 86_400_000
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
