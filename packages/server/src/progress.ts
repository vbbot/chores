import type {
  BinAction,
  ChoreInstance,
  ChoreStreak,
  ChoreTemplate,
  MemberProgress,
  ProgressSummary,
  WeekDay,
} from '@chores/domain';
import {
  completionXp,
  lastSevenDays,
  levelForXp,
  londonDateString,
  londonToday,
  templateStreak,
  weekdayIndex,
} from '@chores/domain';

import { balanceFromData } from './chores';
import { householdCollection } from './households';
import { listMembers } from './users';

function weekStart(today: string): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - weekdayIndex(today));
  return date.toISOString().slice(0, 10);
}

function completionDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return londonDateString(date);
}

function onTime(instance: ChoreInstance): boolean {
  if (typeof instance.on_time === 'boolean') return instance.on_time;
  return completionDate(instance.completed_at) !== null &&
    completionDate(instance.completed_at)! <= instance.due_date;
}

export async function householdProgress(
  householdId: string,
  userId: string
): Promise<ProgressSummary> {
  const [instancesResult, templatesResult, members, binActionsResult] =
    await Promise.all([
      householdCollection(householdId, 'choreInstances').get(),
      householdCollection(householdId, 'choreTemplates').get(),
      listMembers(householdId),
      householdCollection(householdId, 'binActions').get(),
    ]);

  const templates = templatesResult.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ChoreTemplate, 'id'>),
  }));
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const instances = instancesResult.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ChoreInstance, 'id'>),
  }));
  const binActions = binActionsResult.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<BinAction, 'id'>),
  }));

  const today = londonToday();
  const monday = weekStart(today);
  const completed = instances.filter((instance) => instance.status === 'completed');

  const xpForInstance = (instance: ChoreInstance): number => {
    if (typeof instance.xp_awarded === 'number') return instance.xp_awarded;
    const template = templateMap.get(instance.template_id);
    return completionXp(template?.estimated_minutes ?? 15, onTime(instance));
  };

  const memberRows: MemberProgress[] = members.map((member) => {
    const memberCompleted = completed.filter(
      (instance) => instance.completed_by === member.id
    );
    const memberBins = binActions.filter((action) => action.member_id === member.id);
    const total =
      memberCompleted.reduce((sum, instance) => sum + xpForInstance(instance), 0) +
      memberBins.reduce((sum, action) => sum + (action.xp_awarded ?? 0), 0);
    const week =
      memberCompleted
        .filter((instance) => {
          const date = completionDate(instance.completed_at);
          return date !== null && date >= monday && date <= today;
        })
        .reduce((sum, instance) => sum + xpForInstance(instance), 0) +
      memberBins
        .filter((action) => {
          const date = completionDate(action.created_at);
          return date !== null && date >= monday && date <= today;
        })
        .reduce((sum, action) => sum + (action.xp_awarded ?? 0), 0);

    return {
      user_id: member.id,
      name: member.name,
      xp_week: week,
      chores_week: memberCompleted.filter((instance) => {
        const date = completionDate(instance.completed_at);
        return date !== null && date >= monday && date <= today;
      }).length,
      bins_week: memberBins.filter((action) => {
        const date = completionDate(action.created_at);
        return date !== null && date >= monday && date <= today;
      }).length,
      ...levelForXp(total),
    };
  });

  const member = memberRows.find((row) => row.user_id === userId);
  const user = member ?? {
    user_id: userId,
    name: 'You',
    xp_week: 0,
    chores_week: 0,
    bins_week: 0,
    ...levelForXp(0),
  };

  const totalXp = memberRows.reduce((sum, row) => sum + row.total_xp, 0);
  const totalWeek = memberRows.reduce((sum, row) => sum + row.xp_week, 0);
  const totalChoresWeek = memberRows.reduce((sum, row) => sum + row.chores_week, 0);
  const totalBinsWeek = memberRows.reduce((sum, row) => sum + row.bins_week, 0);

  const streaks: ChoreStreak[] = templates
    .filter((template) => template.task_type !== 'one_off')
    .map((template) => {
      const history = instances.filter(
        (instance) => instance.template_id === template.id
      );
      const streak = templateStreak(history, today);
      return {
        template_id: template.id,
        template_name: template.name,
        current: streak.current,
        best: streak.best,
      };
    })
    .filter((streak) => streak.best > 0)
    .sort((a, b) => b.current - a.current || b.best - a.best);

  const week: WeekDay[] = lastSevenDays(today).map((date) => ({
    date,
    completed: completed.filter(
      (instance) => completionDate(instance.completed_at) === date
    ).length,
  }));

  const balance = balanceFromData(instances, templates, members, today);

  return {
    today,
    user,
    household: {
      xp_week: totalWeek,
      chores_week: totalChoresWeek,
      bins_week: totalBinsWeek,
      ...levelForXp(totalXp),
    },
    members: [...memberRows].sort((a, b) => a.name.localeCompare(b.name)),
    balance: balance.members,
    unassigned: balance.unassigned,
    streaks,
    best_streak: streaks.reduce((best, streak) => Math.max(best, streak.best), 0),
    week,
  };
}
