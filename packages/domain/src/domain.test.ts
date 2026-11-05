import { describe, expect, it } from 'vitest';

import { advanceDueDate } from './bills';
import { collectionDates, nextCollection } from './bins';
import { calculateNextDueDate, pickFairAssignee } from './chores';
import { dueLabel, formatUkDate, londonToday, weekdayIndex } from './dates';
import { sortNotes } from './notes';
import { completionXp, levelForXp } from './xp';
import { templateStreak } from './streaks';
import { suggestChores } from './suggestions';

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
    expect(calculateNextDueDate('daily', null, '2026-11-04')).toBe('2026-11-05');
    expect(calculateNextDueDate('weekly', null, '2026-11-04')).toBe('2026-11-11');
    expect(calculateNextDueDate('every_n_days', 4, '2026-11-04')).toBe('2026-11-08');
    expect(calculateNextDueDate('monthly', null, '2026-01-31')).toBe('2026-02-28');
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


describe('xp', () => {
  it('awards minutes plus an on-time bonus', () => {
    expect(completionXp(20, true)).toBe(25);
    expect(completionXp(20, false)).toBe(20);
    expect(completionXp(null, true)).toBe(20);
  });

  it('maps totals to levels', () => {
    expect(levelForXp(0).level).toBe(1);
    expect(levelForXp(100).level).toBe(2);
    expect(levelForXp(300).level).toBe(3);
    expect(levelForXp(600).level).toBe(4);
  });
});

describe('streaks', () => {
  it('counts consecutive on-time completions and lets today stay pending', () => {
    const history = [
      { due_date: '2026-11-01', status: 'completed', on_time: true },
      { due_date: '2026-11-02', status: 'completed', on_time: true },
      { due_date: '2026-11-03', status: 'completed', on_time: true },
      { due_date: '2026-11-04', status: 'pending', on_time: false },
    ];
    expect(templateStreak(history as never, '2026-11-04')).toEqual({
      current: 3,
      best: 3,
    });
  });

  it('breaks the streak on a skip', () => {
    const history = [
      { due_date: '2026-11-01', status: 'completed', on_time: true },
      { due_date: '2026-11-02', status: 'skipped', on_time: false },
      { due_date: '2026-11-03', status: 'completed', on_time: true },
    ];
    expect(templateStreak(history as never, '2026-11-04')).toEqual({
      current: 1,
      best: 1,
    });
  });
});


describe('suggestions', () => {
  it('returns at most one suggestion per room', () => {
    const suggestions = suggestChores({
      month: 11,
      today: '2026-11-05',
      rooms: [
        { id: 'bath', name: 'Bathroom' },
        { id: 'kitchen', name: 'Kitchen' },
        { id: 'living', name: 'Living Room' },
      ],
      templates: [],
      instances: [],
      dismissedIds: [],
      pendingCount: 0,
    });
    const rooms = suggestions.map((suggestion) => suggestion.room_id);
    expect(new Set(rooms).size).toBe(rooms.length);
    expect(suggestions.length).toBeLessThanOrEqual(3);
    expect(suggestions.every((suggestion) => suggestion.reason.length > 0)).toBe(true);
  });
});
