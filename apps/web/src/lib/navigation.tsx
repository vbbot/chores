'use client';

import * as React from 'react';
import {
  MOBILE_TAB_COUNT,
  navigationItem,
  normalizeNavigationOrder,
  type NavigationItem,
  type NavigationItemId,
} from '@chores/domain';
import {
  AllIcon,
  BillsIcon,
  BinsIcon,
  CalendarIcon,
  ChoresIcon,
  HomeIcon,
  NotesIcon,
  ProgressIcon,
  ShoppingIcon,
} from '@/components/icons';
import { useAuth } from '@/lib/auth';

type IconComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

const NAVIGATION_ICONS: Record<NavigationItemId, IconComponent> = {
  dashboard: HomeIcon,
  chores: ChoresIcon,
  bins: BinsIcon,
  shopping: ShoppingIcon,
  bills: BillsIcon,
  calendar: CalendarIcon,
  notes: NotesIcon,
  progress: ProgressIcon,
};

export const allDestination = {
  label: 'All',
  shortLabel: 'All',
  href: '/all',
  description: 'Every household destination in one place',
  Icon: AllIcon,
};

export interface NavigationEntry extends NavigationItem {
  Icon: IconComponent;
}

export function useNavigationOrder(): NavigationEntry[] {
  const { user } = useAuth();
  const order = user?.navigation_order;

  return React.useMemo(
    () =>
      normalizeNavigationOrder(order).map((id) => {
        const item = navigationItem(id);
        return { ...item, Icon: NAVIGATION_ICONS[id] };
      }),
    [order]
  );
}

/** First four saved destinations, which become the mobile bottom tabs. */
export function useMobileNavigation(): NavigationEntry[] {
  return useNavigationOrder().slice(0, MOBILE_TAB_COUNT);
}

export function isNavigationItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** True when the path belongs to a destination outside the mobile bottom tabs. */
export function needsAllTab(
  pathname: string,
  mobileItems: NavigationEntry[]
): boolean {
  return (
    pathname === '/all' ||
    pathname.startsWith('/settings') ||
    mobileItems.every((item) => !isNavigationItemActive(pathname, item.href))
  );
}
