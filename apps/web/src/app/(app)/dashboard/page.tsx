'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { dueLabel, londonDateString } from '@/lib/dates';
import { BinSchedule, ChoreInstance } from '@/lib/types';

export default function DashboardPage() {
  const today = londonDateString();
  const [chores, setChores] = React.useState<ChoreInstance[]>([]);
  const [tonightsBins, setTonightsBins] = React.useState<BinSchedule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [choresData, binsData] = await Promise.all([
        apiFetch<ChoreInstance[]>(
          `/api/v1/chores/instances?status=pending&due_before=${today}`
        ),
        apiFetch<BinSchedule[]>('/api/v1/bins/tonight'),
      ]);
      setChores(choresData);
      setTonightsBins(binsData);
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
      await apiFetch(`/api/v1/chores/instances/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setChores((prev) => prev.filter((chore) => chore.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark this chore done.');
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

      {/* Tonights Bins Widget */}
      {tonightsBins.length > 0 && (
        <Card className="border-heavy bg-surface">
          <CardHeader>
            <div className="text-xs font-semibold uppercase tracking-wider text-secondary">
              Collection Tomorrow Morning
            </div>
            <CardTitle className="text-lg">Put out the bins tonight</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {tonightsBins.map((bin) => (
                <div
                  key={bin.id}
                  className="px-3 py-1.5 border border-foreground bg-background rounded-card text-sm font-semibold flex items-center space-x-2"
                >
                  <span
                    className="w-3 h-3 rounded-full border border-foreground inline-block"
                    style={{ backgroundColor: bin.colour.toLowerCase() }}
                  />
                  <span>
                    {bin.name} ({bin.colour})
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Today's Chores */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Today&apos;s chores</h2>
          <Link href="/chores" className="text-sm font-medium underline text-secondary hover:text-foreground">
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

      {/* Quick Links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-border">
        <Link
          href="/shopping"
          className="p-3 border border-border rounded-card hover:bg-surface text-center"
        >
          <div className="text-sm font-semibold">Shopping list</div>
          <div className="text-xs text-secondary">Check supplies</div>
        </Link>
        <Link
          href="/bins"
          className="p-3 border border-border rounded-card hover:bg-surface text-center"
        >
          <div className="text-sm font-semibold">Bin dates</div>
          <div className="text-xs text-secondary">Schedules</div>
        </Link>
        <Link
          href="/bills"
          className="p-3 border border-border rounded-card hover:bg-surface text-center"
        >
          <div className="text-sm font-semibold">Bills</div>
          <div className="text-xs text-secondary">Upcoming payments</div>
        </Link>
        <Link
          href="/calendar"
          className="p-3 border border-border rounded-card hover:bg-surface text-center"
        >
          <div className="text-sm font-semibold">Calendar</div>
          <div className="text-xs text-secondary">Shared view</div>
        </Link>
      </div>
    </div>
  );
}
