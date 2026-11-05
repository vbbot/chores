import { z } from 'zod';

const altcha = z.string().min(1, 'Complete the verification');

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().email().max(254),
  password: z.string().min(8).max(128),
  household_name: z.string().trim().min(1).max(100).optional(),
  invite_code: z.string().trim().min(1).max(32).optional(),
  altcha,
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
  altcha,
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  notification_prefs: z.record(z.string(), z.unknown()).optional(),
});

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const quietHoursSchema = z.object({
  start: timeSchema,
  end: timeSchema,
});

export const reminderSettingsSchema = z.object({
  digest_time: timeSchema.optional(),
  bins_reminder_time: timeSchema.optional(),
  bill_reminder_days: z.number().int().min(0).max(60).optional(),
  bill_reminder_time: timeSchema.optional(),
  calendar_reminder_minutes: z.number().int().min(0).max(10080).optional(),
  quiet_hours: quietHoursSchema.nullable().optional(),
});

export const householdUpdateSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  house_type: z.string().trim().min(1).max(50).optional(),
  reminder_settings: reminderSettingsSchema.optional(),
});

export const joinHouseholdSchema = z.object({
  invite_code: z.string().trim().min(1).max(32),
});

export const roomCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  room_type: z.string().trim().max(50).default('other'),
  floor: z.number().int().nullable().optional(),
  sort_order: z.number().int().default(0),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export const bulkRoomsSchema = z.object({
  rooms: z.array(roomCreateSchema).min(1),
});

export const assignmentModeSchema = z.enum(['anyone', 'fixed', 'rotate', 'balanced']);

export const choreTemplateCreateSchema = z.object({
  room_id: z.string().min(1).nullable().optional(),
  name: z.string().trim().min(1).max(150),
  description: z.string().nullable().optional(),
  task_type: z.enum(['recurring', 'one_off']).default('recurring'),
  due_date: dateSchema.nullable().optional(),
  start_date: dateSchema.nullable().optional(),
  frequency: z
    .enum(['daily', 'every_n_days', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])
    .default('weekly'),
  frequency_days: z.number().int().positive().nullable().optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  monthly_mode: z.enum(['day_of_month', 'nth_weekday']).nullable().optional(),
  monthly_day: z.number().int().min(1).max(31).nullable().optional(),
  monthly_nth: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(-1)]).nullable().optional(),
  monthly_weekday: z.number().int().min(0).max(6).nullable().optional(),
  end_date: dateSchema.nullable().optional(),
  due_time: timeSchema.nullable().optional(),
  reminder_mode: z.enum(['none', 'at_time', 'before_due']).default('none'),
  reminder_time: timeSchema.nullable().optional(),
  reminder_offset_minutes: z.number().int().min(0).max(10080).nullable().optional(),
  estimated_minutes: z.number().int().positive().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  assignment_mode: assignmentModeSchema.optional(),
  fixed_assignee_id: z.string().min(1).nullable().optional(),
  rotation_member_ids: z.array(z.string().min(1)).nullable().optional(),
});

export const choreTemplateUpdateSchema = choreTemplateCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const choreInstanceFilterSchema = z.object({
  status: z.enum(['pending', 'completed', 'skipped']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_before: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  assigned_to: z.string().min(1).optional(),
  unassigned: z.enum(['true', 'false']).optional(),
  task_type: z.enum(['recurring', 'one_off']).optional(),
  closed: z.enum(['true', 'false']).optional(),
});

export const assignChoreSchema = z.object({
  assigned_to: z.string().min(1).nullable(),
});

export const completeChoreSchema = z.object({
  notes: z.string().nullable().optional(),
});

export const binScheduleCreateSchema = z.object({
  bin_type: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  colour: z.string().trim().min(1).max(50).default('black'),
  collection_day: z.number().int().min(0).max(6),
  frequency: z.enum(['weekly', 'biweekly', 'monthly']).default('weekly'),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reminder_offset_hours: z.number().int().min(0).max(168).default(15),
  reminder_time: timeSchema.nullable().optional(),
});

export const binScheduleUpdateSchema = binScheduleCreateSchema.partial();

export const binExceptionCreateSchema = z.object({
  schedule_id: z.string().min(1),
  original_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  action: z.enum(['skip', 'move']).default('move'),
  moved_to_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reason: z.string().max(200).nullable().optional(),
});

export const billCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  provider: z.string().max(100).nullable().optional(),
  amount_pence: z.number().int().nonnegative().nullable().optional(),
  frequency: z.enum(['weekly', 'monthly', 'quarterly', 'yearly', 'one_off']).default('monthly'),
  due_day: z.number().int().min(1).max(31).nullable().optional(),
  payment_method: z.string().max(50).nullable().optional(),
  account_reference: z.string().max(100).nullable().optional(),
  notes: z.string().nullable().optional(),
  next_due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  reminder_days_before: z.number().int().min(0).max(60).nullable().optional(),
  reminder_time: timeSchema.nullable().optional(),
});

export const billUpdateSchema = billCreateSchema.partial().extend({
  is_active: z.boolean().optional(),
});

export const shoppingListCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const shoppingItemCreateSchema = z.object({
  name: z.string().trim().min(1).max(150),
  category: z.string().max(50).nullable().optional(),
  quantity: z.number().int().positive().default(1),
  unit: z.string().max(20).nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const shoppingItemUpdateSchema = shoppingItemCreateSchema.partial().extend({
  is_checked: z.boolean().optional(),
});

export const calendarEventCreateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().nullable().optional(),
  start_time: z.string().min(1),
  end_time: z.string().nullable().optional(),
  all_day: z.boolean().default(false),
  assigned_to: z.string().min(1).nullable().optional(),
  reminder_minutes_before: z.number().int().min(0).max(10080).nullable().optional(),
  color: z.string().max(30).nullable().optional(),
  category: z.string().max(50).nullable().optional(),
});

export const calendarEventUpdateSchema = calendarEventCreateSchema.partial();

export const noteCreateSchema = z.object({
  title: z.string().trim().min(1).max(150),
  content: z.string().default(''),
  is_pinned: z.boolean().default(false),
  category: z.string().max(50).nullable().optional(),
});

export const noteUpdateSchema = noteCreateSchema.partial();

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().optional(),
  token: z.string().min(10).optional(),
  keys: z.record(z.string(), z.string()).optional(),
  platform: z.enum(['web', 'ios', 'android']).default('web'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function firstZodError(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid request';
}
