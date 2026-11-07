'use client';

import * as React from 'react';
import { NAVIGATION_ITEMS } from '@chores/domain';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { londonDateString } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import { DesktopRail } from './desktop-rail';
import { MobileTabs } from './mobile-tabs';

export function Nav() {
  const queryClient = useQueryClient();

  const prefetch = React.useCallback(
    (href: string) => {
      const today = londonDateString();
      const queries: { key: readonly unknown[]; endpoint: string }[] = [];
      if (href === '/dashboard') {
        queries.push(
          { key: queryKeys.chores.due(today), endpoint: `/api/v1/chores/instances?status=pending&due_before=${today}` },
          { key: queryKeys.bins.tonight, endpoint: '/api/v1/bins/tonight' },
          { key: queryKeys.progress, endpoint: '/api/v1/progress' }
        );
      } else if (href === '/chores') {
        queries.push(
          { key: queryKeys.chores.templates, endpoint: '/api/v1/chores/templates' },
          { key: queryKeys.chores.pending, endpoint: '/api/v1/chores/instances?status=pending' },
          { key: queryKeys.chores.due(today), endpoint: `/api/v1/chores/instances?status=pending&due_before=${today}` },
          { key: queryKeys.members, endpoint: '/api/v1/households/members' },
          { key: queryKeys.suggestions, endpoint: '/api/v1/suggestions' },
          { key: queryKeys.progress, endpoint: '/api/v1/progress' }
        );
      } else if (href === '/bins') {
        queries.push(
          { key: queryKeys.bins.schedules, endpoint: '/api/v1/bins/schedules' },
          { key: queryKeys.bins.exceptions, endpoint: '/api/v1/bins/exceptions' }
        );
      } else if (href === '/shopping') {
        queries.push({ key: queryKeys.shopping, endpoint: '/api/v1/shopping/lists' });
      } else if (href === '/bills') {
        queries.push({ key: queryKeys.bills, endpoint: '/api/v1/bills' });
      } else if (href === '/calendar') {
        queries.push({ key: queryKeys.calendar, endpoint: '/api/v1/calendar/events' });
      } else if (href === '/notes') {
        queries.push({ key: queryKeys.notes, endpoint: '/api/v1/notes' });
      } else if (href === '/progress') {
        queries.push({ key: queryKeys.progress, endpoint: '/api/v1/progress' });
      } else if (href === '/meals') {
        queries.push(
          { key: queryKeys.meals.ideas, endpoint: '/api/v1/meals/ideas' },
          { key: queryKeys.meals.recipes(''), endpoint: '/api/v1/recipes?q=' }
        );
      } else if (href === '/health') {
        queries.push({ key: queryKeys.health, endpoint: '/api/v1/health' });
      }
      queries.forEach(({ key, endpoint }) => {
        queryClient.prefetchQuery({ queryKey: key, queryFn: () => apiFetch(endpoint) });
      });
    },
    [queryClient]
  );

  React.useEffect(() => {
    NAVIGATION_ITEMS.forEach((item) => prefetch(item.href));
    queryClient.prefetchQuery({ queryKey: queryKeys.household, queryFn: () => apiFetch('/api/v1/households') });
    queryClient.prefetchQuery({ queryKey: queryKeys.members, queryFn: () => apiFetch('/api/v1/households/members') });
    // Prefetch once for the current household session.
  }, [prefetch, queryClient]);

  return (
    <>
      <DesktopRail onPrefetch={prefetch} />
      <MobileTabs />
    </>
  );
}
