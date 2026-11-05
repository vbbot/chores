import Link from 'next/link';
import type { ProgressSummary } from '@/lib/types';
import { ProgressBar } from './progress-bar';

export function ProgressWidget({ summary }: { summary: ProgressSummary }) {
  const best = summary.streaks[0];

  return (
    <section className="border-2 border-foreground rounded-card p-4 space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">Progress</h2>
        <Link
          href="/progress"
          className="text-xs font-medium underline text-secondary hover:text-foreground min-h-[44px] inline-flex items-center"
        >
          View progress
        </Link>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Your level {summary.user.level}</span>
          <span className="text-xs text-secondary tabular-nums">
            {summary.user.into_level} / {summary.user.next_level_xp - summary.user.level_xp} XP
          </span>
        </div>
        <ProgressBar value={summary.user.progress} label="Your level progress" />
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium">Household level {summary.household.level}</span>
          <span className="text-xs text-secondary tabular-nums">
            {summary.household.total_xp} XP
          </span>
        </div>
        <ProgressBar value={summary.household.progress} label="Household level progress" />
      </div>

      <p className="text-xs text-secondary">
        {!best
          ? 'Complete a chore to start a streak.'
          : best.current > 0
            ? `${best.template_name}: ${best.current} on time in a row`
            : `Best streak: ${best.template_name}, ${best.best} on time in a row`}
      </p>
    </section>
  );
}
