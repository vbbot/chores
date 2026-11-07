import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NAVIGATION_ORDER,
  NAVIGATION_ITEM_IDS,
  normalizeNavigationOrder,
} from './navigation';

describe('navigation order', () => {
  it('returns the default order when nothing is saved', () => {
    expect(normalizeNavigationOrder(null)).toEqual(DEFAULT_NAVIGATION_ORDER);
    expect(normalizeNavigationOrder([])).toEqual(DEFAULT_NAVIGATION_ORDER);
  });

  it('keeps a saved order', () => {
    const saved = [...NAVIGATION_ITEM_IDS].reverse();
    expect(normalizeNavigationOrder(saved)).toEqual(saved);
  });

  it('drops unknown and duplicate ids', () => {
    const saved = ['notes', 'notes', 'unknown', 'dashboard'];
    expect(normalizeNavigationOrder(saved)).toEqual([
      'notes',
      'dashboard',
      ...NAVIGATION_ITEM_IDS.filter((id) => id !== 'notes' && id !== 'dashboard'),
    ]);
  });

  it('appends new destinations instead of losing them', () => {
    const saved = ['notes', 'dashboard', 'chores', 'bins'];
    const order = normalizeNavigationOrder(saved);
    expect(order.slice(0, 4)).toEqual(saved);
    expect(order).toHaveLength(NAVIGATION_ITEM_IDS.length);
    expect(new Set(order)).toEqual(new Set(NAVIGATION_ITEM_IDS));
  });
});
