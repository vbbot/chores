import { describe, expect, it } from 'vitest';

import {
  choreOnTime,
  firstChoreDueDate,
  inQuietHours,
  londonNow,
  nextChoreDueAfter,
  londonWallTimeToIso,
  nextChoreDueDate,
  shiftLocalDateTime,
} from './schedule';

describe('first chore due date', () => {
  it('starts on the next selected weekday', () => {
    expect(
      firstChoreDueDate({
        start_date: '2026-11-05',
        frequency: 'weekly',
        weekdays: [0],
      })
    ).toBe('2026-11-09');
  });

  it('uses the selected weekday when the start date matches', () => {
    expect(
      firstChoreDueDate({
        start_date: '2026-11-09',
        frequency: 'weekly',
        weekdays: [0, 2],
      })
    ).toBe('2026-11-09');
  });

  it('finds the first matching monthly day', () => {
    expect(
      firstChoreDueDate({
        start_date: '2026-01-01',
        frequency: 'monthly',
        monthly_mode: 'day_of_month',
        monthly_day: 31,
      })
    ).toBe('2026-01-31');
  });

  it('finds the first monthly nth weekday', () => {
    expect(
      firstChoreDueDate({
        start_date: '2026-11-01',
        frequency: 'monthly',
        monthly_mode: 'nth_weekday',
        monthly_nth: -1,
        monthly_weekday: 4,
      })
    ).toBe('2026-11-27');
  });
});

describe('next chore due date', () => {
  it('walks multiple weekdays', () => {
    expect(
      nextChoreDueDate(
        {
          frequency: 'weekly',
          weekdays: [0, 2, 4],
          recurrence_anchor_date: '2026-11-09',
        },
        '2026-11-09'
      )
    ).toBe('2026-11-11');
  });

  it('keeps fortnightly parity', () => {
    expect(
      nextChoreDueDate(
        {
          frequency: 'biweekly',
          weekdays: [0],
          recurrence_anchor_date: '2026-11-09',
        },
        '2026-11-09'
      )
    ).toBe('2026-11-23');
  });

  it('clamps month-end dates', () => {
    expect(
      nextChoreDueDate(
        { frequency: 'monthly', monthly_mode: 'day_of_month', monthly_day: 31 },
        '2026-01-31'
      )
    ).toBe('2026-02-28');
  });

  it('advances monthly nth weekdays', () => {
    expect(
      nextChoreDueDate(
        {
          frequency: 'monthly',
          monthly_mode: 'nth_weekday',
          monthly_nth: -1,
          monthly_weekday: 4,
        },
        '2026-11-27'
      )
    ).toBe('2026-12-25');
  });

  it('stops after the end date', () => {
    expect(
      nextChoreDueDate(
        {
          frequency: 'daily',
          end_date: '2026-11-06',
        },
        '2026-11-06'
      )
    ).toBeNull();
  });

  it('skips missed occurrences when catching up', () => {
    expect(
      nextChoreDueAfter(
        { frequency: 'daily', recurrence_anchor_date: '2026-11-01' },
        '2026-11-01',
        '2026-11-05'
      )
    ).toBe('2026-11-06');
  });

  it('treats one-off tasks as closed', () => {
    expect(
      nextChoreDueDate(
        { task_type: 'one_off', frequency: 'weekly' },
        '2026-11-06'
      )
    ).toBeNull();
  });
});

describe('chore time rules', () => {
  it('handles optional due times', () => {
    const now = new Date('2026-11-05T17:00:00Z');
    expect(choreOnTime('2026-11-05', '18:00', now)).toBe(true);
    expect(choreOnTime('2026-11-05', '16:00', now)).toBe(false);
    expect(choreOnTime('2026-11-05', null, now)).toBe(true);
    expect(choreOnTime('2026-11-04', '18:00', now)).toBe(false);
  });

  it('uses London local time', () => {
    expect(londonNow(new Date('2026-07-01T06:30:00Z'))).toMatchObject({
      date: '2026-07-01',
      time: '07:30',
    });
  });

  it('detects overnight quiet hours', () => {
    expect(inQuietHours('23:00', { start: '22:00', end: '07:00' })).toBe(true);
    expect(inQuietHours('06:30', { start: '22:00', end: '07:00' })).toBe(true);
    expect(inQuietHours('12:00', { start: '22:00', end: '07:00' })).toBe(false);
  });

  it('converts London wall time to UTC across DST', () => {
    expect(londonWallTimeToIso('2026-07-01T10:00')).toBe(
      '2026-07-01T09:00:00.000Z'
    );
    expect(londonWallTimeToIso('2026-12-01T10:00')).toBe(
      '2026-12-01T10:00:00.000Z'
    );
  });

  it('shifts reminders across midnight', () => {
    expect(shiftLocalDateTime('2026-11-05', '00:30', -60)).toEqual({
      date: '2026-11-04',
      time: '23:30',
    });
  });
});
