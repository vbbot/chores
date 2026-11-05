'use client';

import * as React from 'react';
import Link from 'next/link';
import { ProgressWidget } from '@/components/progress/progress-widget';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { dueLabel, londonDateString } from '@/lib/dates';
import { BinAction, BinSchedule, ChoreInstance, ProgressSummary } from '@/lib/types';

interface CompletionResponse {
  xp_awarded: number;
  on_time: boolean;
  streak_current: number;
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function DashboardPage() {
  const today = londonDateString();
  const [chores, setChores] = React.useState<ChoreInstance[]>([]);
  const [tonightsBins, setTonightsBins] = React.useState<BinSchedule[]>([]);
  const [progress, setProgress] = React.useState<ProgressSummary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [binsBusy, setBinsBusy] = React.useState(false);

  const loadProgress = async () => {
    try {
      setProgress(await apiFetch<ProgressSummary>('/api/v1/progress'));
    } catch {
      setProgress(null);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const progressPromise = loadProgress();
      const [choresData, binsData] = await Promise.all([
        apiFetch<ChoreInstance[]>(
          `/api/v1/chores/instances?status=pending&due_before=${today}`
        ),
        apiFetch<BinSchedule[]>('/api/v1/bins/tonight'),
      ]);
      setChores(choresData);
      setTonightsBins(binsData);
      await progressPromise;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const completeChore = async (id: string) => {
    setActionError(null);
    try {
      const result = await apiFetch<CompletionResponse>(
        `/api/v1/chores/instances/${id}/complete`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setChores((prev) => prev.filter((chore) => chore.id !== id));
      const streak =
        result.streak_current > 1 ? ` ${result.streak_current} on time in a row.` : '';
      setStatusMessage(`Done. +${result.xp_awarded} XP.${streak}`);
      await loadProgress();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark this chore done.');
    }
  };

  const markBinsOut = async () => {
    setBinsBusy(true);
    setActionError(null);
    const remaining = tonightsBins.filter((bin) => !bin.put_out_at).length;
    try {
      const actions = await apiFetch<BinAction[]>('/api/v1/bins/actions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const updated = await apiFetch<BinSchedule[]>('/api/v1/bins/tonight');
      setTonightsBins(updated);
      const newActions = remaining > 0 ? Math.min(remaining, actions.length) : 0;
      setStatusMessage(
        newActions > 0
          ? `Bins out. +${newActions * 5} XP.`
          : 'Bins were already out.'
      );
      await loadProgress();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark the bins out.');
    } finally {
      setBinsBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Today at home</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading tasks and bin schedules...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Today at home</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error}
        </div>
        <Button onClick={loadData} variant="secondary">
          Try again
        </Button>
      </div>
    );
  }

  const allBinsOut =
    tonightsBins.length > 0 && tonightsBins.every((bin) => bin.put_out_at);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Today at home</h1>
        <p className="text-sm text-secondary">Household schedule and tasks for today.</p>
      </div>

      {actionError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError}
        </div>
      )}
      {statusMessage && (
        <p
          role="status"
          className="p-3 text-sm rounded-card border border-foreground bg-surface font-medium"
        >
          {statusMessage}
        </p>
      )}

      {tonightsBins.length > 0 && (
        <Card className="border-heavy bg-surface">
          <CardHeader>
            <div className="text-xs font-semibold text-secondary">
              Collection tomorrow morning
            </div>
            <CardTitle className="text-lg">Put the bins out tonight</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {tonightsBins.map((bin) => (
                <div
                  key={bin.id}
                  className="px-3 py-2 border border-foreground bg-background rounded-card text-sm font-semibold flex items-center space-x-2"
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
                  ? ` at ${timeLabel(tonightsBins[0].put_out_at)}`
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
          </CardContent>
        </Card>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Today&apos;s chores</h2>
          <Link
            href="/chores"
            className="text-sm font-medium underline text-secondary hover:text-foreground"
          >
            View all chores
          </Link>
        </div>

        {chores.length === 0 ? (
          <EmptyState
            title="All clear for today"
            description="No pending chores scheduled for today. Take a break or add a new task."
            actionLabel="Add a chore"
            onAction={() => (window.location.href = '/chores')}
          />
        ) : (
          <div className="space-y-2">
            {chores.map((chore) => {
              const overdue = chore.due_date < today;
              return (
                <div
                  key={chore.id}
                  className={`p-3 border rounded-card bg-background flex items-center justify-between gap-3 ${
                    overdue ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <div>
                    <div className="font-medium text-sm">{chore.template_name || 'Task'}</div>
                    <div
                      className={`text-xs ${
                        overdue ? 'text-destructive font-medium' : 'text-secondary'
                      }`}
                    >
                      {dueLabel(chore.due_date, today)}
                      {chore.room_name ? ` • ${chore.room_name}` : ''}
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
        )}
      </div>

      {progress && <ProgressWidget summary={progress} />}
    </div>
  );
}
