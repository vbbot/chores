import { describe, expect, it } from 'vitest';

import { advanceDueDate } from './bills';
import { collectionDates, nextCollection } from './bins';
import { calculateNextDueDate, pickFairAssignee } from './chores';
import { dueLabel, formatUkDate, londonToday, weekdayIndex } from './dates';
import { sortNotes } from './notes';

const weekly = {
  collection_day: 4,
  frequency: 'weekly',
  start_date: '2026-11-02',
  is_active: true,
};

describe('bin collection dates', () => {
  it('finds weekly collections and honours skips', () => {
    expect(nextCollection(weekly, '2026-11-02')).toBe('2026-11-06');
    expect(
      nextCollection(weekly, '2026-11-02', [
        { original_date: '2026-11-06', action: 'skip', moved_to_date: null },
      ])
    ).toBe('2026-11-13');
  });

  it('moves a collection to the replacement date', () => {
    const dates = collectionDates(weekly, '2026-11-02', [
      { original_date: '2026-11-06', action: 'move', moved_to_date: '2026-11-07' },
    ]);
    expect(dates).toContain('2026-11-07');
    expect(dates).not.toContain('2026-11-06');
  });

  it('keeps fortnightly parity', () => {
    const dates = collectionDates(
      { collection_day: 4, frequency: 'biweekly', start_date: '2026-11-06', is_active: true },
      '2026-11-02',
      [],
      5
    );
    expect(dates).toEqual(['2026-11-06', '2026-11-20', '2026-12-04']);
  });
});

describe('bill dates', () => {
  it('advances across month ends', () => {
    expect(advanceDueDate('2030-01-31', 'monthly')).toBe('2030-02-28');
    expect(advanceDueDate('2030-11-30', 'quarterly')).toBe('2031-02-28');
    expect(advanceDueDate('2030-02-28', 'yearly')).toBe('2031-02-28');
    expect(advanceDueDate('2030-02-28', 'one_off')).toBeNull();
  });
});

describe('chores', () => {
  it('calculates recurrence', () => {
    expect(calculateNextDueDate('weekly', null, '2026-11-04')).toBe('2026-11-11');
    expect(calculateNextDueDate('every_n_days', 4, '2026-11-04')).toBe('2026-11-08');
  });

  it('picks the least-loaded member', () => {
    const members = [{ id: 'a' }, { id: 'b' }];
    expect(pickFairAssignee(members, { a: 3, b: 1 })).toBe('b');
  });
});

describe('dates', () => {
  it('uses Monday-based weekdays', () => {
    expect(weekdayIndex('2026-11-02')).toBe(0);
    expect(weekdayIndex('2026-11-08')).toBe(6);
  });

  it('formats due labels', () => {
    const today = londonToday();
    expect(dueLabel(today, today)).toBe('Due today');
    expect(formatUkDate('2026-11-05')).toBe('5 Nov 2026');
  });
});

describe('notes', () => {
  it('puts pinned notes first, then newest', () => {
    const notes = [
      { id: 'a', is_pinned: false, updated_at: '2026-01-03T00:00:00Z' },
      { id: 'b', is_pinned: true, updated_at: '2026-01-01T00:00:00Z' },
      { id: 'c', is_pinned: false, updated_at: '2026-01-02T00:00:00Z' },
    ] as never;
    expect(sortNotes(notes).map((note: { id: string }) => note.id)).toEqual(['b', 'a', 'c']);
  });
});
