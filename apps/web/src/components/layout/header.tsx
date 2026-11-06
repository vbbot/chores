'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { BellIcon, SearchIcon, SettingsIcon } from '@/components/icons';
import { ThemeToggle } from '@/components/theme-toggle';
import { Dialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Notification } from '@/lib/types';

interface SearchHit {
  id: string;
  title: string;
  subtitle: string;
  url: string;
}

interface SearchResults {
  chores: SearchHit[];
  notes: SearchHit[];
  bills: SearchHit[];
  events: SearchHit[];
  shopping: SearchHit[];
}

function notificationDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<SearchResults | null>(null);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const searchErrorId = React.useId();
  const settingsActive = pathname === '/settings';

  const notificationsQuery = useApiQuery<Notification[]>(
    queryKeys.notifications,
    '/api/v1/notifications',
    { enabled: !!user, refetchInterval: 60_000 }
  );
  const notifications = notificationsQuery.data ?? [];
  const unread = notifications.filter((notification) => !notification.is_read).length;
  const notificationsLabel =
    unread > 0 ? `Notifications, ${unread} unread` : 'Notifications, no unread';

  const markRead = async (notification: Notification) => {
    try {
      if (!notification.is_read) {
        await apiFetch(`/api/v1/notifications/${notification.id}/read`, {
          method: 'PUT',
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
      }
    } catch {
      // Still navigate; the notification can be marked read on the next load.
    }
    const url =
      typeof notification.data?.url === 'string'
        ? notification.data.url
        : '/dashboard';
    setNotificationsOpen(false);
    router.push(url);
  };

  const markAllRead = async () => {
    try {
      await apiFetch('/api/v1/notifications/read-all', { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    } catch {
      // Leave the unread state unchanged.
    }
  };

  const executeSearch = async () => {
    if (searchQuery.trim().length < 2) {
      setSearchResults(null);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      setSearchResults(
        await apiFetch<SearchResults>(
          `/api/v1/search?q=${encodeURIComponent(searchQuery.trim())}`
        )
      );
    } catch {
      setSearchResults(null);
      setSearchError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const runSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void executeSearch();
  };

  const openResult = (url: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    setSearchError(null);
    router.push(url);
  };

  const resultGroups: { label: string; items: SearchHit[] }[] = searchResults
    ? [
        { label: 'Chores', items: searchResults.chores },
        { label: 'Notes', items: searchResults.notes },
        { label: 'Bills', items: searchResults.bills },
        { label: 'Calendar', items: searchResults.events },
        { label: 'Shopping', items: searchResults.shopping },
      ]
    : [];

  return (
    <header className="border-b border-border bg-background px-4 min-h-[60px] flex items-center justify-between">
      <Link
        href="/dashboard"
        className="text-xl font-semibold tracking-tight min-h-[44px] inline-flex items-center"
      >
        Chores
      </Link>

      <div className="flex items-center gap-1">
        {user && (
          <span className="text-xs text-secondary hidden sm:inline mr-2">{user.name}</span>
        )}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          title="Search"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-btn text-secondary hover:text-foreground hover:bg-surface transition-colors"
        >
          <SearchIcon className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setNotificationsOpen(true);
            notificationsQuery.refetch();
          }}
          aria-label={notificationsLabel}
          title="Notifications"
          className="relative min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-btn text-secondary hover:text-foreground hover:bg-surface transition-colors"
        >
          <BellIcon className="w-5 h-5" />
          {unread > 0 && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-semibold leading-4 text-center"
            >
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          aria-current={settingsActive ? 'page' : undefined}
          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-btn transition-colors ${
            settingsActive
              ? 'text-accent bg-surface'
              : 'text-secondary hover:text-foreground hover:bg-surface'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
        </Link>
      </div>

      <Dialog
        open={searchOpen}
        onClose={() => {
          setSearchOpen(false);
          setSearchError(null);
        }}
        title="Search household"
      >
        <div className="space-y-4">
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              aria-label="Search household"
              aria-invalid={searchError ? true : undefined}
              aria-describedby={searchError ? searchErrorId : undefined}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Chores, notes, bills, events, shopping"
              className="flex-1 h-11 px-3 border border-border rounded-card bg-background text-base"
            />
            <button
              type="submit"
              className="min-h-[44px] px-3 border border-border rounded-card text-sm font-semibold"
            >
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchError && (
            <div
              id={searchErrorId}
              role="alert"
              className="flex flex-wrap items-center justify-between gap-2 p-3 border border-destructive rounded-card text-sm text-destructive"
            >
              <p>{searchError}</p>
              <button
                type="button"
                onClick={() => void executeSearch()}
                className="min-h-[44px] px-2 text-sm font-semibold underline underline-offset-4"
              >
                Try again
              </button>
            </div>
          )}

          {!searchError &&
            searchResults &&
            resultGroups.filter((group) => group.items.length > 0).length === 0 && (
              <p className="text-sm text-secondary">No matches.</p>
            )}

          {resultGroups
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <section key={group.label} className="space-y-2">
                <h3 className="text-xs font-semibold text-secondary">{group.label}</h3>
                {group.items.map((item) => (
                  <button
                    key={`${group.label}-${item.id}`}
                    type="button"
                    onClick={() => openResult(item.url)}
                    className="w-full text-left p-3 border border-border rounded-card hover:bg-surface transition-colors"
                  >
                    <p className="text-sm font-semibold">{item.title}</p>
                    {item.subtitle && (
                      <p className="text-xs text-secondary mt-0.5 line-clamp-2">
                        {item.subtitle}
                      </p>
                    )}
                  </button>
                ))}
              </section>
            ))}
        </div>
      </Dialog>

      <Dialog
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Notifications"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-secondary">
              {unread > 0 ? `${unread} unread` : 'All caught up'}
            </p>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
              >
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-secondary">
              No notifications yet. Chore, bin, bill, and calendar reminders appear here.
            </p>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => markRead(notification)}
                  className={`w-full text-left p-3 rounded-card border transition-colors ${
                    notification.is_read
                      ? 'border-border'
                      : 'border-accent bg-surface'
                  }`}
                >
                  <p className="text-sm font-semibold">{notification.title}</p>
                  <p className="text-xs text-secondary mt-1 whitespace-pre-wrap">
                    {notification.body}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] text-secondary tabular-nums">
                      {notificationDate(notification.created_at)}
                    </p>
                    {!notification.is_read && (
                      <span className="text-[11px] font-semibold text-secondary">Unread</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Dialog>
    </header>
  );
}
