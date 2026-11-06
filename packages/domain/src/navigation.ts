export const NAVIGATION_ITEM_IDS = [
  'dashboard',
  'chores',
  'bins',
  'shopping',
  'bills',
  'calendar',
  'notes',
  'progress',
] as const;

export type NavigationItemId = (typeof NAVIGATION_ITEM_IDS)[number];

export type NavigationGroup = 'daily' | 'household';

export interface NavigationItem {
  id: NavigationItemId;
  label: string;
  shortLabel: string;
  href: string;
  group: NavigationGroup;
  description: string;
}

const navigationDefinitions: Record<NavigationItemId, Omit<NavigationItem, 'id'>> = {
  dashboard: {
    label: 'Dashboard',
    shortLabel: 'Home',
    href: '/dashboard',
    group: 'daily',
    description: 'Today, bins, and progress',
  },
  chores: {
    label: 'Chores',
    shortLabel: 'Chores',
    href: '/chores',
    group: 'daily',
    description: 'Due work, one-off tasks, and schedule',
  },
  bins: {
    label: 'Bins',
    shortLabel: 'Bins',
    href: '/bins',
    group: 'daily',
    description: 'Collection dates and changes',
  },
  shopping: {
    label: 'Shopping',
    shortLabel: 'Shop',
    href: '/shopping',
    group: 'daily',
    description: 'Shared shopping list',
  },
  bills: {
    label: 'Bills',
    shortLabel: 'Bills',
    href: '/bills',
    group: 'household',
    description: 'Due dates and payments',
  },
  calendar: {
    label: 'Calendar',
    shortLabel: 'Calendar',
    href: '/calendar',
    group: 'household',
    description: 'Visits and commitments',
  },
  notes: {
    label: 'Notes',
    shortLabel: 'Notes',
    href: '/notes',
    group: 'household',
    description: 'Shared household notes',
  },
  progress: {
    label: 'Progress',
    shortLabel: 'Progress',
    href: '/progress',
    group: 'household',
    description: 'Levels, streaks, and workload',
  },
};

export const NAVIGATION_ITEMS: readonly NavigationItem[] = NAVIGATION_ITEM_IDS.map(
  (id) => ({ id, ...navigationDefinitions[id] })
);

export const NAVIGATION_GROUPS: readonly {
  id: NavigationGroup;
  label: string;
  description: string;
}[] = [
  { id: 'daily', label: 'Daily', description: 'The work that comes round most often' },
  { id: 'household', label: 'Household', description: 'Money, plans, notes, and progress' },
];

/** Number of leading items that become mobile bottom tabs. */
export const MOBILE_TAB_COUNT = 4;

/** Fixed destination shown after the saved items in the mobile bar and All page. */
export const ALL_DESTINATION_HREF = '/all';
export const SETTINGS_DESTINATION_HREF = '/settings';

export const DEFAULT_NAVIGATION_ORDER: readonly NavigationItemId[] = NAVIGATION_ITEM_IDS;

export function isNavigationItemId(value: unknown): value is NavigationItemId {
  return (
    typeof value === 'string' &&
    (NAVIGATION_ITEM_IDS as readonly string[]).includes(value)
  );
}

/**
 * Keeps a saved order valid as destinations change.
 * Unknown and duplicate ids are dropped; new destinations are appended in
 * default order so they never disappear from navigation.
 */
export function normalizeNavigationOrder(value: unknown): NavigationItemId[] {
  const saved = Array.isArray(value) ? value : [];
  const seen = new Set<NavigationItemId>();
  const order: NavigationItemId[] = [];

  for (const id of saved) {
    if (!isNavigationItemId(id) || seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }

  for (const id of NAVIGATION_ITEM_IDS) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
  }

  return order;
}

export function navigationItem(id: NavigationItemId): NavigationItem {
  return NAVIGATION_ITEMS.find((item) => item.id === id)!;
}
