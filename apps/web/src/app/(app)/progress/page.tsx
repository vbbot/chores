'use client';

import * as React from 'react';
import Link from 'next/link';
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

  const balance = summary.balance ?? [];
  const unassigned = summary.unassigned ?? { open_chores: 0, open_minutes: 0 };

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
              <caption className="sr-only">
                This week by household member: chores, bins, and XP.
              </caption>
              <thead>
                <tr className="text-left text-xs text-secondary border-b border-border">
                  <th scope="col" className="py-2 pr-3 font-semibold">Member</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Chores</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Bins</th>
                  <th scope="col" className="py-2 font-semibold text-right">XP</th>
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
          <div className="flex items-baseline justify-between gap-3">
            <CardTitle className="text-base">Workload balance</CardTitle>
            <span className="text-xs text-secondary">Estimated minutes</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">
                Workload balance by member: minutes done in the last seven days, open
                minutes and open chores, and overdue chores.
              </caption>
              <thead>
                <tr className="text-left text-xs text-secondary border-b border-border">
                  <th scope="col" className="py-2 pr-3 font-semibold">Member</th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">
                    Done last 7 days
                  </th>
                  <th scope="col" className="py-2 pr-3 font-semibold text-right">Open</th>
                  <th scope="col" className="py-2 font-semibold text-right">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {balance.map((member) => (
                  <tr key={member.user_id} className="border-b border-border last:border-b-0">
                    <td className="py-3 pr-3">{member.name}</td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {member.done_minutes} min
                    </td>
                    <td className="py-3 pr-3 text-right tabular-nums">
                      {member.open_minutes} min
                      <span className="sr-only">
                        {', '}
                        {member.open_chores} open{' '}
                        {member.open_chores === 1 ? 'chore' : 'chores'}
                      </span>
                      <span aria-hidden="true" className="text-xs text-secondary">
                        {' '}
                        ({member.open_chores})
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {member.overdue_chores}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {unassigned.open_chores > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-x-3">
              <p className="text-xs text-secondary">
                {unassigned.open_chores}{' '}
                {unassigned.open_chores === 1 ? 'chore is' : 'chores are'} up for
                grabs, about {unassigned.open_minutes} minutes.
              </p>
              <Link
                href="/chores"
                className="inline-flex min-h-[44px] items-center text-xs font-semibold underline underline-offset-4 transition-colors hover:text-secondary"
              >
                View chores
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last seven days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {summary.week.map((day) => {
              const isToday = day.date === summary.today;
              const stateClass =
                day.completed > 0
                  ? 'bg-foreground text-background'
                  : isToday
                    ? 'text-accent'
                    : 'text-secondary';
              const borderClass = isToday
                ? 'border-accent'
                : day.completed > 0
                  ? 'border-foreground'
                  : 'border-border';
              return (
                <div
                  key={day.date}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={`${isToday ? 'Today, ' : ''}${formatUkDate(day.date)}: ${day.completed} completed`}
                  className={`min-h-[64px] border rounded-card p-2 text-center ${stateClass} ${borderClass}`}
                >
                  {isToday && <span className="sr-only">Today</span>}
                  <div className="text-xs font-semibold">{dayLabel(day.date)}</div>
                  <div className="text-sm font-semibold tabular-nums mt-1">
                    {day.completed}
                  </div>
                </div>
              );
            })}
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
