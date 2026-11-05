'use client';

import * as React from 'react';
import { ProgressBar } from '@/components/progress/progress-bar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { formatUkDate } from '@/lib/dates';
import { ProgressSummary } from '@/lib/types';

function dayLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
  }).format(new Date(`${value}T12:00:00Z`));
}

export default function ProgressPage() {
  const { data: summary, isLoading, error, refetch } = useApiQuery<ProgressSummary>(
    queryKeys.progress,
    '/api/v1/progress'
  );


  if (isLoading && !summary) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Progress</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household progress...
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Progress</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load progress.'}
        </div>
        <Button onClick={() => refetch()} variant="secondary">
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-secondary">
          Shared effort, personal levels, and on-time chore streaks.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">Your level {summary.user.level}</CardTitle>
              <span className="text-sm font-semibold tabular-nums">
                {summary.user.total_xp} XP
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar value={summary.user.progress} label="Your level progress" />
            <p className="text-xs text-secondary tabular-nums">
              {summary.user.into_level} /{' '}
              {summary.user.next_level_xp - summary.user.level_xp} XP to level{' '}
              {summary.user.level + 1}
            </p>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{summary.user.xp_week} XP</span>{' '}
              this week. {summary.user.chores_week}{' '}
              {summary.user.chores_week === 1 ? 'chore' : 'chores'} and {summary.user.bins_week}{' '}
              {summary.user.bins_week === 1 ? 'bin' : 'bins'} out.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-baseline justify-between gap-3">
              <CardTitle className="text-base">
                Household level {summary.household.level}
              </CardTitle>
              <span className="text-sm font-semibold tabular-nums">
                {summary.household.total_xp} XP
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressBar
              value={summary.household.progress}
              label="Household level progress"
            />
            <p className="text-xs text-secondary tabular-nums">
              {summary.household.into_level} /{' '}
              {summary.household.next_level_xp - summary.household.level_xp} XP to level{' '}
              {summary.household.level + 1}
            </p>
            <p className="text-sm">
              <span className="font-semibold tabular-nums">
                {summary.household.xp_week} XP
              </span>{' '}
              this week. {summary.household.chores_week}{' '}
              {summary.household.chores_week === 1 ? 'chore' : 'chores'} and {summary.household.bins_week}{' '}
              {summary.household.bins_week === 1 ? 'bin' : 'bins'} out.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">This week</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-secondary border-b border-border">
                  <th className="py-2 pr-3 font-semibold">Member</th>
                  <th className="py-2 pr-3 font-semibold text-right">Chores</th>
                  <th className="py-2 pr-3 font-semibold text-right">Bins</th>
                  <th className="py-2 font-semibold text-right">XP</th>
                </tr>
              </thead>
              <tbody>
                {summary.members.map((member) => (
                  <tr key={member.user_id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-3">{member.name}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {member.chores_week}
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {member.bins_week}
                    </td>
                    <td className="py-3 text-right tabular-nums font-medium">
                      {member.xp_week}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last seven days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {summary.week.map((day) => (
              <div
                key={day.date}
                aria-label={`${formatUkDate(day.date)}: ${day.completed} completed`}
                className={`min-h-[64px] border rounded-card p-2 text-center ${
                  day.completed > 0
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-secondary'
                }`}
              >
                <div className="text-xs font-semibold">{dayLabel(day.date)}</div>
                <div className="text-sm font-semibold tabular-nums mt-1">
                  {day.completed}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">On-time streaks</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.streaks.length === 0 ? (
            <p className="text-sm text-secondary">
              Complete a chore on time to start a streak.
            </p>
          ) : (
            <div className="space-y-2">
              {summary.streaks.map((streak) => (
                <div
                  key={streak.template_id}
                  className="flex items-center justify-between gap-3 p-3 border border-border rounded-card"
                >
                  <span className="text-sm font-medium">{streak.template_name}</span>
                  <span className="text-xs text-secondary tabular-nums">
                    {streak.current} in a row, best {streak.best}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
