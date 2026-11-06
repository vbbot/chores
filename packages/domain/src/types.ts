export type UserRole = 'admin' | 'member';
export type AssignmentMode = 'anyone' | 'fixed' | 'rotate' | 'balanced';
export type ChoreTaskType = 'recurring' | 'one_off';
export type ReminderMode = 'none' | 'at_time' | 'before_due';
export type MonthlyMode = 'day_of_month' | 'nth_weekday';

export interface QuietHours {
  start: string;
  end: string;
}

export interface ReminderSettings {
  digest_time: string;
  bins_reminder_time: string;
  bill_reminder_days: number;
  bill_reminder_time: string;
  calendar_reminder_minutes: number;
  quiet_hours: QuietHours | null;
}

export interface NotificationPrefs {
  digest?: { enabled?: boolean; time?: string | null };
  chores?: { enabled?: boolean };
  bins?: { enabled?: boolean; time?: string | null };
  bills?: { enabled?: boolean; days_before?: number | null; time?: string | null };
  calendar?: { enabled?: boolean; minutes_before?: number | null };
  quiet_hours?: { enabled?: boolean };
}

export interface User {
  id: string;
  household_id: string | null;
  name: string;
  email: string;
  role: UserRole;
  notification_prefs: NotificationPrefs;
  ical_token: string | null;
  created_at: string;
}

export interface Room {
  id: string;
  household_id: string;
  name: string;
  room_type: string;
  floor: number | null;
  sort_order: number;
}

export interface Household {
  id: string;
  name: string;
  house_type: string;
  invite_code: string;
  reminder_settings?: ReminderSettings;
  created_at: string;
  rooms: Room[];
}

export interface ChoreTemplate {
  id: string;
  household_id: string;
  room_id: string | null;
  name: string;
  description: string | null;
  frequency: string;
  frequency_days: number | null;
  estimated_minutes: number | null;
  priority: 'low' | 'medium' | 'high';
  is_active: boolean;
  task_type?: ChoreTaskType;
  assignment_mode?: AssignmentMode;
  fixed_assignee_id?: string | null;
  rotation_member_ids?: string[] | null;
  rotation_last_assignee_id?: string | null;
  start_date?: string | null;
  recurrence_anchor_date?: string | null;
  weekdays?: number[] | null;
  monthly_mode?: MonthlyMode | null;
  monthly_day?: number | null;
  monthly_nth?: number | null;
  monthly_weekday?: number | null;
  end_date?: string | null;
  due_time?: string | null;
  reminder_mode?: ReminderMode;
  reminder_time?: string | null;
  reminder_offset_minutes?: number | null;
  next_due_date?: string | null;
  streak_current?: number;
  streak_best?: number;
  created_at: string;
}

export interface ChoreInstance {
  id: string;
  template_id: string;
  household_id: string;
  assigned_to: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  completed_by: string | null;
  due_date: string;
  due_time?: string | null;
  completed_at: string | null;
  status: 'pending' | 'completed' | 'skipped';
  task_type?: ChoreTaskType;
  notes: string | null;
  xp_awarded?: number;
  on_time?: boolean;
  template_name?: string;
  room_name?: string;
}

export interface BinSchedule {
  id: string;
  household_id: string;
  bin_type: string;
  name: string;
  colour: string;
  collection_day: number;
  frequency: string;
  start_date: string;
  reminder_offset_hours: number;
  reminder_time?: string | null;
  is_active: boolean;
  next_collection?: string;
  put_out_at?: string | null;
  put_out_by?: string | null;
  put_out_by_name?: string | null;
}

export interface BinAction {
  id: string;
  schedule_id: string;
  collection_date: string;
  member_id: string;
  created_at: string;
  xp_awarded: number;
}

export interface BinException {
  id: string;
  schedule_id: string;
  original_date: string;
  action: 'skip' | 'move';
  moved_to_date: string | null;
  reason: string | null;
}

export interface Bill {
  id: string;
  household_id: string;
  name: string;
  provider: string | null;
  amount_pence: number | null;
  frequency: string;
  due_day: number | null;
  payment_method: string | null;
  account_reference: string | null;
  notes: string | null;
  next_due_date: string | null;
  reminder_days_before?: number | null;
  reminder_time?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  list_id: string;
  added_by: string | null;
  name: string;
  category: string | null;
  quantity: number;
  unit: string | null;
  is_checked: boolean;
  notes: string | null;
  checked_at: string | null;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  items: ShoppingItem[];
}

export interface CalendarEvent {
  id: string;
  household_id: string;
  created_by: string | null;
  assigned_to: string | null;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  reminder_minutes_before?: number | null;
  color: string | null;
  category: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  household_id: string;
  author_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  category: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}
