'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { londonDateString } from '@/lib/dates';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const primaryNav = [
  { label: 'Dashboard', shortLabel: 'Home', href: '/dashboard' },
  { label: 'Chores', shortLabel: 'Chores', href: '/chores' },
  { label: 'Bins', shortLabel: 'Bins', href: '/bins' },
  { label: 'Shopping', shortLabel: 'Shop', href: '/shopping' },
];

const moreNav = [
  { label: 'Bills', href: '/bills' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Notes', href: '/notes' },
  { label: 'Progress', href: '/progress' },
];

const desktopNav = [
  ...primaryNav.map(({ label, href }) => ({ label, href })),
  ...moreNav,
];

const FOCUSABLE =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Nav() {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const closeMore = React.useCallback((restoreFocus = true) => {
    setMoreOpen(false);
    if (restoreFocus) moreButtonRef.current?.focus();
  }, []);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!moreOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeMore();
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = panelRef.current;
      if (!panel || panel.offsetParent === null) return;

      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (element) => element.offsetParent !== null
      );
      if (focusable.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!panel.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || moreButtonRef.current?.contains(target)) {
        return;
      }
      const focusWasInside = panelRef.current?.contains(document.activeElement);
      closeMore(false);
      if (focusWasInside) moreButtonRef.current?.focus();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [moreOpen, closeMore]);

  const prefetch = (href: string) => {
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
    }
    queries.forEach(({ key, endpoint }) => {
      queryClient.prefetchQuery({ queryKey: key, queryFn: () => apiFetch(endpoint) });
    });
  };

  React.useEffect(() => {
    ['/dashboard', '/chores', '/bins', '/shopping', '/bills', '/calendar', '/notes', '/progress'].forEach(
      prefetch
    );
    queryClient.prefetchQuery({ queryKey: queryKeys.household, queryFn: () => apiFetch('/api/v1/households') });
    queryClient.prefetchQuery({ queryKey: queryKeys.members, queryFn: () => apiFetch('/api/v1/households/members') });
    // Prefetch once for the current household session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreNav.some((item) => isActive(item.href));
  const mobileIndex = moreActive || moreOpen
    ? 4
    : Math.max(0, primaryNav.findIndex((item) => isActive(item.href)));

  return (
    <>
      <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:self-start md:sticky md:top-[60px] md:h-[calc(100vh-60px)] md:overflow-y-auto border-r border-border py-4 bg-background">
        {desktopNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onMouseEnter={() => prefetch(item.href)}
            onFocus={() => prefetch(item.href)}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'relative px-4 py-2.5 text-sm transition-colors',
              isActive(item.href)
                ? 'text-foreground font-semibold'
                : 'text-secondary hover:text-foreground hover:bg-surface'
            )}
          >
            {isActive(item.href) && (
              <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-accent" />
            )}
            {item.label}
          </Link>
        ))}
      </aside>

      {moreOpen && (
        <div
          ref={panelRef}
          id="more-sections"
          role="dialog"
          aria-modal="true"
          aria-label="More sections"
          tabIndex={-1}
          className="sheet-enter md:hidden fixed bottom-16 left-0 right-0 z-50 border-t border-border bg-background p-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onMouseEnter={() => prefetch(item.href)}
                onFocus={() => prefetch(item.href)}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'px-3 py-3 rounded-card border text-sm font-medium min-h-[44px] flex items-center transition-colors',
                  isActive(item.href)
                    ? 'border-accent text-accent bg-surface font-semibold'
                    : 'border-border text-foreground hover:bg-surface'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="relative md:hidden fixed bottom-0 left-0 right-0 border-t border-border bg-background grid grid-cols-5 z-40 pb-[env(safe-area-inset-bottom)]"
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center min-h-[56px] px-1 text-xs transition-colors border-r border-border last:border-r-0',
              isActive(item.href)
                ? 'font-semibold text-foreground'
                : 'text-secondary'
            )}
          >
            {item.shortLabel}
          </Link>
        ))}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => {
            if (moreOpen) {
              closeMore();
            } else {
              setMoreOpen(true);
            }
          }}
          aria-expanded={moreOpen}
          aria-controls="more-sections"
          className={cn(
            'flex items-center justify-center min-h-[56px] px-1 text-xs transition-colors',
            moreActive || moreOpen
              ? 'font-semibold text-foreground'
              : 'text-secondary'
          )}
        >
          More
        </button>
        <span
          aria-hidden="true"
          className="absolute bottom-[env(safe-area-inset-bottom)] left-0 h-0.5 w-1/5 bg-accent transition-transform duration-200 ease-zune"
          style={{ transform: `translateX(${mobileIndex * 100}%)` }}
        />
      </nav>
    </>
  );
}
