/** ISO date (YYYY-MM-DD) for the household timezone, not the device UTC date. */
export function londonDateString(value: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}

/** Short UK date for an ISO date or timestamp. */
export function formatUkDate(value: string): string {
  const date = value.length <= 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat('en-GB', {
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
