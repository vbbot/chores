import type { BinException, BinSchedule } from './types';
import { addDays, daysBetween, weekdayIndex } from './dates';

export type BinScheduleRules = Pick<
  BinSchedule,
  'collection_day' | 'frequency' | 'start_date' | 'is_active'
>;

export type BinExceptionRules = Pick<
  BinException,
  'original_date' | 'action' | 'moved_to_date'
>;

const CYCLE_WEEKS: Record<string, number> = {
  weekly: 1,
  biweekly: 2,
  monthly: 4,
};

function isScheduled(schedule: BinScheduleRules, day: string): boolean {
  if (day < schedule.start_date) return false;
  if (weekdayIndex(day) !== schedule.collection_day) return false;
  const cycle = CYCLE_WEEKS[schedule.frequency] ?? 1;
  const weeksSinceStart = Math.floor(daysBetween(schedule.start_date, day) / 7);
  return weeksSinceStart % cycle === 0;
}

/** Scheduled collections in the window, after skip and move exceptions. */
export function collectionDates(
  schedule: BinScheduleRules,
  fromDate: string,
  exceptions: BinExceptionRules[] = [],
  weeks = 8
): string[] {
  const byOriginal = new Map(
    exceptions.map((exception) => [exception.original_date, exception])
  );
  const dates: string[] = [];
  let day = fromDate;
  const horizon = addDays(fromDate, weeks * 7);

  while (day < horizon) {
    if (isScheduled(schedule, day)) {
      const exception = byOriginal.get(day);
      if (!exception) {
        dates.push(day);
      } else if (exception.action === 'move' && exception.moved_to_date) {
        dates.push(exception.moved_to_date);
      }
    }
    day = addDays(day, 1);
  }

  return Array.from(new Set(dates.filter((date) => date >= fromDate))).sort();
}

export function nextCollection(
  schedule: BinScheduleRules,
  fromDate: string,
  exceptions: BinExceptionRules[] = []
): string | null {
  for (const weeks of [8, 26]) {
    const dates = collectionDates(schedule, fromDate, exceptions, weeks);
    if (dates.length > 0) return dates[0];
  }
  return null;
}
