import { addMonths } from './bills';
import {
  addDays,
  daysBetween,
  isoDate,
  parseIsoDate,
  weekdayIndex,
} from './dates';
import type {
  ChoreTemplate,
  MonthlyMode,
  QuietHours,
  ReminderSettings,
} from './types';

export const DEFAULT_REMINDER_SETTINGS: ReminderSettings = {
  digest_time: '07:00',
  bins_reminder_time: '19:00',
  bill_reminder_days: 3,
  bill_reminder_time: '09:00',
  calendar_reminder_minutes: 60,
  quiet_hours: null,
};

export function resolveReminderSettings(
  value: Partial<ReminderSettings> | null | undefined
): ReminderSettings {
  return {
    ...DEFAULT_REMINDER_SETTINGS,
    ...(value ?? {}),
    quiet_hours: value?.quiet_hours ?? DEFAULT_REMINDER_SETTINGS.quiet_hours,
  };
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return Math.max(0, Math.min(1439, (hours || 0) * 60 + (minutes || 0)));
}

export function minutesToTime(value: number): string {
  const minutes = Math.max(0, Math.min(1439, Math.round(value)));
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(
    minutes % 60
  ).padStart(2, '0')}`;
}

export function addMinutesToTime(value: string, minutes: number): string {
  return minutesToTime(timeToMinutes(value) + minutes);
}

export function shiftLocalDateTime(
  date: string,
  time: string,
  minutes: number
): { date: string; time: string } {
  const total = timeToMinutes(time) + minutes;
  const dayShift = Math.floor(total / 1440);
  return {
    date: addDays(date, dayShift),
    time: minutesToTime(((total % 1440) + 1440) % 1440),
  };
}

export interface LondonNow {
  date: string;
  time: string;
  weekday: number;
  dateTime: string;
}

export function londonNow(value: Date = new Date()): LondonNow {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
  return { date, time, weekday: weekdayIndex(date), dateTime: `${date}T${time}` };
}

export function localDateTime(date: string, time: string): string {
  return `${date}T${time}`;
}

function londonOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour'),
    get('minute'),
    get('second')
  );
  return Math.round((asUtc - date.getTime()) / 60_000);
}

/** Converts a London wall-clock datetime-local value to a UTC ISO instant. */
export function londonWallTimeToIso(value: string): string {
  const [datePart, timePart] = value.split('T');
  if (!datePart || !timePart) return new Date(value).toISOString();
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.slice(0, 5).split(':').map(Number);
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = londonOffsetMinutes(new Date(wallAsUtc));
  let instant = wallAsUtc - firstOffset * 60_000;
  const secondOffset = londonOffsetMinutes(new Date(instant));
  if (secondOffset !== firstOffset) instant = wallAsUtc - secondOffset * 60_000;
  return new Date(instant).toISOString();
}

export function compareLocalDateTime(a: string, b: string): number {
  return a.localeCompare(b);
}

export function inQuietHours(time: string, quiet: QuietHours | null | undefined): boolean {
  if (!quiet) return false;
  if (!quiet.start || !quiet.end || quiet.start === quiet.end) return false;
  if (quiet.start < quiet.end) {
    return time >= quiet.start && time < quiet.end;
  }
  return time >= quiet.start || time < quiet.end;
}

function dateAt(year: number, monthIndex: number, day: number): string {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return isoDate(
    new Date(Date.UTC(year, monthIndex, Math.min(Math.max(1, day), lastDay)))
  );
}

function nthWeekdayOfMonth(
  year: number,
  monthIndex: number,
  nth: number,
  weekday: number
): string {
  if (nth === -1) {
    const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
    for (let day = lastDay; day >= 1; day -= 1) {
      const candidate = dateAt(year, monthIndex, day);
      if (weekdayIndex(candidate) === weekday) return candidate;
    }
    return dateAt(year, monthIndex, lastDay);
  }

  const first = dateAt(year, monthIndex, 1);
  const offset = (weekday - weekdayIndex(first) + 7) % 7;
  return dateAt(year, monthIndex, 1 + offset + (Math.max(1, nth) - 1) * 7);
}

function monthlyOccurrence(
  anchor: string,
  intervalMonths: number,
  mode: MonthlyMode,
  day: number,
  nth: number,
  weekday: number
): string {
  const base = parseIsoDate(anchor);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  if (mode === 'nth_weekday') {
    return nthWeekdayOfMonth(year, month, nth, weekday);
  }
  return dateAt(year, month, day);
}

export function firstChoreDueDate(template: {
  task_type?: string;
  start_date?: string | null;
  frequency?: string;
  weekdays?: number[] | null;
  monthly_mode?: MonthlyMode | null;
  monthly_day?: number | null;
  monthly_nth?: number | null;
  monthly_weekday?: number | null;
  end_date?: string | null;
}): string | null {
  const start = template.start_date ?? null;
  if (!start) return null;
  if (template.task_type === 'one_off') return start;

  const frequency = template.frequency ?? 'weekly';
  if (frequency === 'weekly' || frequency === 'biweekly') {
    const weekdays = [...(template.weekdays ?? [])].sort((a, b) => a - b);
    if (weekdays.length === 0) return start;
    for (let offset = 0; offset < 14; offset += 1) {
      const candidate = addDays(start, offset);
      if (weekdays.includes(weekdayIndex(candidate))) return candidate;
    }
    return start;
  }

  if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
    const interval = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
    const mode: MonthlyMode = template.monthly_mode ?? 'day_of_month';
    const day = template.monthly_day ?? parseIsoDate(start).getUTCDate();
    const nth = template.monthly_nth ?? 1;
    const weekday = template.monthly_weekday ?? weekdayIndex(start);

    for (let step = 0; step < 24; step += 1) {
      const monthAnchor = addMonths(start, step * interval);
      const candidate = monthlyOccurrence(monthAnchor, interval, mode, day, nth, weekday);
      if (candidate >= start) return candidate;
    }
    return start;
  }

  return start;
}

export function nextChoreDueDate(
  template: Pick<
    ChoreTemplate,
    | 'task_type'
    | 'frequency'
    | 'frequency_days'
    | 'weekdays'
    | 'monthly_mode'
    | 'monthly_day'
    | 'monthly_nth'
    | 'monthly_weekday'
    | 'start_date'
    | 'recurrence_anchor_date'
    | 'end_date'
  >,
  fromDate: string
): string | null {
  if (template.task_type === 'one_off') return null;
  const frequency = template.frequency ?? 'weekly';
  const end = template.end_date ?? null;

  let next: string | null = null;

  if (frequency === 'daily') {
    next = addDays(fromDate, 1);
  } else if (frequency === 'every_n_days') {
    next = addDays(fromDate, Math.max(1, template.frequency_days ?? 3));
  } else if (frequency === 'weekly' || frequency === 'biweekly') {
    const interval = frequency === 'biweekly' ? 2 : 1;
    const weekdays = [...(template.weekdays ?? [])].sort((a, b) => a - b);
    const allowed = weekdays.length > 0 ? weekdays : [weekdayIndex(fromDate)];
    const anchor =
      template.recurrence_anchor_date ?? template.start_date ?? fromDate;
    const anchorWeek = addDays(anchor, -weekdayIndex(anchor));

    for (let offset = 1; offset <= 7 * interval * 2 + 14; offset += 1) {
      const candidate = addDays(fromDate, offset);
      if (!allowed.includes(weekdayIndex(candidate))) continue;
      const candidateWeek = addDays(candidate, -weekdayIndex(candidate));
      const weeks = Math.round(daysBetween(anchorWeek, candidateWeek) / 7);
      if (interval === 1 || weeks % interval === 0) {
        next = candidate;
        break;
      }
    }
  } else if (frequency === 'monthly' || frequency === 'quarterly' || frequency === 'yearly') {
    const interval = frequency === 'quarterly' ? 3 : frequency === 'yearly' ? 12 : 1;
    const mode: MonthlyMode = template.monthly_mode ?? 'day_of_month';
    const day = template.monthly_day ?? parseIsoDate(fromDate).getUTCDate();
    const nth = template.monthly_nth ?? 1;
    const weekday = template.monthly_weekday ?? weekdayIndex(fromDate);

    for (let step = 1; step <= 24; step += 1) {
      const monthAnchor = addMonths(fromDate, step * interval);
      const candidate = monthlyOccurrence(monthAnchor, interval, mode, day, nth, weekday);
      if (candidate > fromDate) {
        next = candidate;
        break;
      }
    }
  }

  if (!next) return null;
  if (end && next > end) return null;
  return next;
}

export function nextChoreDueAfter(
  template: Pick<
    ChoreTemplate,
    | 'task_type'
    | 'frequency'
    | 'frequency_days'
    | 'weekdays'
    | 'monthly_mode'
    | 'monthly_day'
    | 'monthly_nth'
    | 'monthly_weekday'
    | 'start_date'
    | 'recurrence_anchor_date'
    | 'end_date'
  >,
  fromDate: string,
  today: string
): string | null {
  let next = nextChoreDueDate(template, fromDate);
  let guard = 0;
  while (next && next <= today && guard < 800) {
    next = nextChoreDueDate(template, next);
    guard += 1;
  }
  return next;
}

export function choreOnTime(
  dueDate: string,
  dueTime: string | null | undefined,
  now: Date = new Date()
): boolean {
  const current = londonNow(now);
  if (current.date < dueDate) return true;
  if (current.date > dueDate) return false;
  if (!dueTime) return true;
  return current.time <= dueTime;
}
