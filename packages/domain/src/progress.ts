import type { LevelProgress } from './xp';

export interface MemberProgress extends LevelProgress {
  user_id: string;
  name: string;
  xp_week: number;
  chores_week: number;
  bins_week: number;
}

export interface HouseholdProgress extends LevelProgress {
  xp_week: number;
  chores_week: number;
  bins_week: number;
}

export interface ChoreStreak {
  template_id: string;
  template_name: string;
  current: number;
  best: number;
}

export interface WeekDay {
  date: string;
  completed: number;
}

export interface MemberBalance {
  user_id: string;
  name: string;
  open_minutes: number;
  done_minutes: number;
  open_chores: number;
  overdue_chores: number;
}

export interface UnassignedBalance {
  open_chores: number;
  open_minutes: number;
}

export interface ProgressSummary {
  today: string;
  user: MemberProgress;
  household: HouseholdProgress;
  members: MemberProgress[];
  balance: MemberBalance[];
  unassigned: UnassignedBalance;
  streaks: ChoreStreak[];
  best_streak: number;
  week: WeekDay[];
}
