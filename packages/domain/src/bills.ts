import { parseIsoDate, isoDate } from './dates';

export function addMonths(value: string, months: number): string {
  const date = parseIsoDate(value);
  const monthIndex = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(monthIndex / 12);
  const month = ((monthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(date.getUTCDate(), lastDay);
  return isoDate(new Date(Date.UTC(year, month, day)));
}

/** Next due date after payment. One-off bills retire. */
export function advanceDueDate(current: string, frequency: string): string | null {
  switch (frequency) {
    case 'weekly':
      return isoDate(new Date(parseIsoDate(current).getTime() + 7 * 86_400_000));
    case 'monthly':
      return addMonths(current, 1);
    case 'quarterly':
      return addMonths(current, 3);
    case 'yearly':
      return addMonths(current, 12);
    case 'one_off':
      return null;
    default:
      return addMonths(current, 1);
  }
}
