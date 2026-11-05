import { describe, expect, it } from 'vitest';

import {
  defaultAssignmentMode,
  nextRotationAssignee,
  pickBalancedAssignee,
} from './assignment';
import { calculateNextDueAfter } from './chores';

const members = [
  { id: 'a', name: 'Alex' },
  { id: 'b', name: 'Sam' },
  { id: 'c', name: 'Robin' },
];

describe('assignment modes', () => {
  it('defaults a household to auto-balance', () => {
    expect(defaultAssignmentMode(0)).toBe('anyone');
    expect(defaultAssignmentMode(1)).toBe('balanced');
    expect(defaultAssignmentMode(2)).toBe('balanced');
  });

  it('rotates through members and wraps', () => {
    expect(nextRotationAssignee(['a', 'b', 'c'], null, null)).toBe('a');
    expect(nextRotationAssignee(['a', 'b', 'c'], null, 'a')).toBe('b');
    expect(nextRotationAssignee(['a', 'b', 'c'], null, 'c')).toBe('a');
  });

  it('honours a selected rotation group and order', () => {
    expect(nextRotationAssignee(['a', 'b', 'c'], ['c', 'a'], null)).toBe('c');
    expect(nextRotationAssignee(['a', 'b', 'c'], ['c', 'a'], 'c')).toBe('a');
  });

  it('ignores members who left the household', () => {
    expect(nextRotationAssignee(['a', 'b'], ['a', 'c'], 'c')).toBe('a');
  });
});

describe('balanced assignment', () => {
  it('picks the lightest rolling load', () => {
    expect(
      pickBalancedAssignee(members, {
        a: { minutes: 90, open_chores: 2, last_assigned_at: null },
        b: { minutes: 30, open_chores: 1, last_assigned_at: null },
        c: { minutes: 60, open_chores: 1, last_assigned_at: null },
      })
    ).toBe('b');
  });

  it('uses open chore count as the first tie-break', () => {
    expect(
      pickBalancedAssignee(members, {
        a: { minutes: 30, open_chores: 2, last_assigned_at: null },
        b: { minutes: 30, open_chores: 1, last_assigned_at: null },
        c: { minutes: 40, open_chores: 0, last_assigned_at: null },
      })
    ).toBe('b');
  });

  it('uses the longest time since assignment as the next tie-break', () => {
    expect(
      pickBalancedAssignee(members, {
        a: { minutes: 30, open_chores: 1, last_assigned_at: '2026-11-04T09:00:00Z' },
        b: { minutes: 30, open_chores: 1, last_assigned_at: '2026-11-02T09:00:00Z' },
        c: { minutes: 30, open_chores: 1, last_assigned_at: '2026-11-03T09:00:00Z' },
      })
    ).toBe('b');
  });

  it('prefers a member who has never been assigned', () => {
    expect(
      pickBalancedAssignee(members, {
        a: { minutes: 30, open_chores: 1, last_assigned_at: '2026-11-04T09:00:00Z' },
        b: { minutes: 30, open_chores: 1, last_assigned_at: null },
        c: { minutes: 30, open_chores: 1, last_assigned_at: '2026-11-01T09:00:00Z' },
      })
    ).toBe('b');
  });
});

describe('recurrence cadence', () => {
  it('advances from the due date so late completion does not drift', () => {
    expect(calculateNextDueAfter('weekly', null, '2026-11-02', '2026-11-04')).toBe(
      '2026-11-09'
    );
  });

  it('skips missed daily occurrences instead of building a backlog', () => {
    expect(calculateNextDueAfter('daily', null, '2026-11-01', '2026-11-05')).toBe(
      '2026-11-06'
    );
  });
});
