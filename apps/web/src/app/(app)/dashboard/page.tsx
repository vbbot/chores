'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { ProgressWidget } from '@/components/progress/progress-widget';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dueLabel, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { BinSchedule, ChoreInstance, ProgressSummary, User } from '@/lib/types';

interface CompletionResponse {
  xp_awarded: number;
  on_time: boolean;
  streak_current: number;
}

export default function DashboardPage() {
  const today = londonDateString();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const choresQuery = useApiQuery<ChoreInstance[]>(
    queryKeys.chores.due(today),
    `/api/v1/chores/instances?status=pending&due_before=${today}`
  );
  const binsQuery = useApiQuery<BinSchedule[]>(queryKeys.bins.tonight, '/api/v1/bins/tonight');
  const progressQuery = useApiQuery<ProgressSummary>(queryKeys.progress, '/api/v1/progress');
  const membersQuery = useApiQuery<User[]>(queryKeys.members, '/api/v1/households/members');

  const chores = choresQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const tonightsBins = binsQuery.data ?? [];
  const progress = progressQuery.data ?? null;

  const myChores = chores.filter((chore) => chore.assigned_to === user?.id);
  const openChores = chores.filter((chore) => chore.assigned_to === null);
  const otherChores = chores.filter(
    (chore) => chore.assigned_to !== null && chore.assigned_to !== user?.id
  );

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [binsBusy, setBinsBusy] = React.useState(false);

  const completeChore = async (id: string) => {
    setActionError(null);
    try {
      const result = await apiFetch<CompletionResponse>(
        `/api/v1/chores/instances/${id}/complete`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      queryClient.setQueryData<ChoreInstance[]>(queryKeys.chores.due(today), (prev) =>
        prev?.filter((chore) => chore.id !== id)
      );
      const streak =
        result.streak_current > 1 ? ` ${result.streak_current} on time in a row.` : '';
      setStatusMessage(`Done. +${result.xp_awarded} XP.${streak}`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.progress }),
        queryClient.invalidateQueries({ queryKey: queryKeys.chores.all }),
      ]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark this chore done.');
    }
  };

  const markBinsOut = async () => {
    setBinsBusy(true);
    setActionError(null);
    const remaining = tonightsBins.filter((bin) => !bin.put_out_at).length;
    try {
      const actions = await apiFetch<unknown[]>('/api/v1/bins/actions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.bins.tonight }),
        queryClient.invalidateQueries({ queryKey: queryKeys.progress }),
      ]);
      setStatusMessage(
        remaining > 0
          ? `Bins out. +${Math.min(remaining, actions.length) * 5} XP.`
          : 'Bins were already out.'
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark the bins out.');
    } finally {
      setBinsBusy(false);
    }
  };

  const loading = !choresQuery.data && (choresQuery.isLoading || binsQuery.isLoading);
  const error = choresQuery.error ?? binsQuery.error;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Today at home</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading tasks and bin schedules...
        </div>
      </div>
    );
  }

  if (error && !choresQuery.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Today at home</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load the dashboard.'}
        </div>
        <Button
          onClick={() => {
            choresQuery.refetch();
            binsQuery.refetch();
          }}
          variant="secondary"
        >
          Try again
        </Button>
      </div>
    );
  }

  const allBinsOut =
    tonightsBins.length > 0 && tonightsBins.every((bin) => bin.put_out_at);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-accent">
          {new Intl.DateTimeFormat('en-GB', {
            timeZone: 'Europe/London',
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          }).format(new Date())}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight mt-1">Today at home</h1>
        <p className="text-sm text-secondary">Your household schedule for today.</p>
      </div>

      {actionError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError}
        </div>
      )}
      {statusMessage && (
        <p role="status" className="p-3 text-sm rounded-card border border-border bg-surface font-medium">
          {statusMessage}
        </p>
      )}

      {tonightsBins.length > 0 && (
        <section className="border-heavy border-foreground rounded-card bg-surface p-4 space-y-3">
          <div>
            <p className="text-xs font-semibold text-secondary">
              Collection tomorrow morning
            </p>
            <h2 className="text-xl font-semibold mt-1">Put the bins out tonight</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {tonightsBins.map((bin) => (
              <div
                key={bin.id}
                className="px-3 py-2 border border-border bg-background rounded-card text-sm font-semibold flex items-center space-x-2"
              >
                <span
                  className="w-3 h-3 rounded-full border border-foreground inline-block"
                  style={{ backgroundColor: bin.colour.toLowerCase() }}
                />
                <span>
                  {bin.name} ({bin.colour})
                </span>
                {bin.put_out_at && <span className="text-xs text-secondary">Out</span>}
              </div>
            ))}
          </div>

          {allBinsOut ? (
            <p className="text-sm text-secondary">
              Bins out
              {tonightsBins[0]?.put_out_by_name
                ? ` by ${tonightsBins[0].put_out_by_name}`
                : ''}
              {tonightsBins[0]?.put_out_at
                ? ` at ${new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Europe/London',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(tonightsBins[0].put_out_at))}`
                : ''}
              .
            </p>
          ) : (
            <Button
              onClick={markBinsOut}
              variant="secondary"
              disabled={binsBusy}
              className="text-xs px-3 py-1"
            >
              {binsBusy ? 'Saving...' : 'Mark bins out'}
            </Button>
          )}
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Today&apos;s chores</h2>
          <Link
            href="/chores"
            className="text-sm text-secondary underline hover:text-foreground min-h-[44px] inline-flex items-center"
          >
            View all chores
          </Link>
        </div>

        {chores.length === 0 ? (
          <EmptyState
            title="All clear for today"
            description="No pending chores scheduled for today."
            actionLabel="Add a chore"
            onAction={() => (window.location.href = '/chores')}
          />
        ) : (
          <div className="space-y-6">
            {[
              { key: 'mine', title: 'Your chores', items: myChores, showOwner: false },
              { key: 'open', title: 'Up for grabs', items: openChores, showOwner: false },
              {
                key: 'others',
                title: 'Other household chores',
                items: otherChores,
                showOwner: true,
              },
            ]
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <div key={group.key} className="space-y-2">
                  <h3 className="text-xs font-semibold text-secondary">{group.title}</h3>
                  {group.items.map((chore) => {
                    const overdue = chore.due_date < today;
                    const owner = chore.assigned_to
                      ? members.find((member) => member.id === chore.assigned_to)?.name ??
                        'Someone'
                      : 'Anyone';
                    return (
                      <div
                        key={chore.id}
                        className={`p-3 border rounded-card bg-background flex items-center justify-between gap-3 ${
                          overdue ? 'border-destructive' : 'border-border'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-sm">
                            {chore.template_name || 'Task'}
                          </div>
                          <div
                            className={`text-xs ${
                              overdue ? 'text-destructive font-medium' : 'text-secondary'
                            }`}
                          >
                            {dueLabel(chore.due_date, today)}
                            {chore.room_name ? ` • ${chore.room_name}` : ''}
                            {group.showOwner ? ` • ${owner}` : ''}
                            {chore.task_type === 'one_off' ? ' • One-off' : ''}
                          </div>
                        </div>
                        <Button
                          onClick={() => completeChore(chore.id)}
                          variant="secondary"
                          className="text-xs px-3 py-1"
                        >
                          Mark done
                        </Button>
                      </div>
                    );
                  })}
                </div>
              ))}
          </div>
        )}
      </section>

      {progress && <ProgressWidget summary={progress} />}
    </div>
  );
}
