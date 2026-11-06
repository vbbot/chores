import type {
  Bill,
  CalendarEvent,
  ChoreInstance,
  ChoreTemplate,
  NotificationPrefs,
  ReminderSettings,
  User,
} from '@chores/domain';
import {
  addDays,
  addMinutesToTime,
  formatUkDate,
  inQuietHours,
  londonDateString,
  londonNow,
  resolveReminderSettings,
  shiftLocalDateTime,
} from '@chores/domain';

import { binsTonight } from './bins';
import { listBills } from './bills';
import { listCalendarEvents } from './calendar';
import { listChoreInstances, listChoreTemplates } from './chores';
import { dbAdmin } from './firebase';
import { householdCollection } from './households';
import { addNotification, sendPushToUser } from './notifications';
import { listMembers } from './users';

export interface ReminderRunResult {
  briefs: number;
  chores: number;
  bins: number;
  bills: number;
  calendar: number;
}

function prefsFor(user: User): NotificationPrefs {
  return user.notification_prefs ?? {};
}

function householdSettings(value: unknown): ReminderSettings {
  return resolveReminderSettings(value as Partial<ReminderSettings> | undefined);
}

function quietNow(
  user: User,
  settings: ReminderSettings,
  time: string
): boolean {
  if (user.notification_prefs?.quiet_hours?.enabled === false) return false;
  return inQuietHours(time, settings.quiet_hours);
}

async function claimDelivery(householdId: string, key: string): Promise<boolean> {
  const ref = householdCollection(householdId, 'reminderDeliveries').doc(key);
  try {
    await ref.create({ created_at: new Date().toISOString() });
    return true;
  } catch (error) {
    if ((error as { code?: number }).code === 6) return false;
    throw error;
  }
}

async function releaseDelivery(householdId: string, key: string): Promise<void> {
  try {
    await householdCollection(householdId, 'reminderDeliveries').doc(key).delete();
  } catch (error) {
    console.error(`Could not release reminder delivery ${key}`, error);
  }
}

async function notify(
  userId: string,
  input: { title: string; body: string; url: string }
): Promise<boolean> {
  await addNotification(userId, {
    type: 'reminder',
    title: input.title,
    body: input.body,
    data: { url: input.url },
  });
  await sendPushToUser(userId, input);
  return true;
}

function choreLine(instances: ChoreInstance[]): string {
  const names = instances.map((instance) => instance.template_name ?? 'Task');
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

function calendarLine(event: CalendarEvent): string {
  const start = new Date(event.start_time);
  if (event.all_day) return event.title;
  const time = londonNow(start).time;
  return `${event.title} at ${time}`;
}

async function sendBriefs(
  householdId: string,
  members: User[],
  settings: ReminderSettings,
  now: ReturnType<typeof londonNow>,
  result: ReminderRunResult
): Promise<void> {
  const [pendingInstances, tonightsBins, bills, events] = await Promise.all([
    listChoreInstances(householdId, { status: 'pending' }),
    binsTonight(householdId),
    listBills(householdId),
    listCalendarEvents(householdId),
  ]);

  const dueChores = pendingInstances.filter(
    (instance) => instance.due_date <= now.date
  );
  const todaysEvents = events.filter(
    (event) => londonDateString(new Date(event.start_time)) === now.date
  );

  for (const member of members) {
    const prefs = prefsFor(member);
    if (prefs.digest?.enabled === false) continue;
    const digestTime = prefs.digest?.time ?? settings.digest_time;
    if (now.time < digestTime) continue;
    if (quietNow(member, settings, now.time)) continue;

    const parts: string[] = [];

    if (prefs.chores?.enabled !== false) {
      const mine = dueChores.filter(
        (instance) =>
          instance.assigned_to === member.id || instance.assigned_to === null
      );
      if (mine.length > 0) {
        const overdue = mine.filter((instance) => instance.due_date < now.date).length;
        parts.push(
          `${mine.length} chore${mine.length === 1 ? '' : 's'}: ${choreLine(mine)}${
            overdue > 0 ? ` (${overdue} overdue)` : ''
          }.`
        );
      }
    }

    const binsLeft = tonightsBins.filter((bin) => !bin.put_out_at);
    if (prefs.bins?.enabled !== false && binsLeft.length > 0) {
      parts.push(`Bins tonight: ${binsLeft.map((bin) => bin.name).join(', ')}.`);
    }

    if (prefs.bills?.enabled !== false) {
      const days = prefs.bills?.days_before ?? settings.bill_reminder_days;
      const soon = bills.filter(
        (bill) =>
          bill.next_due_date &&
          bill.next_due_date >= now.date &&
          bill.next_due_date <= addDays(now.date, days)
      );
      if (soon.length > 0) {
        parts.push(
          `Bills: ${soon
            .map((bill) => `${bill.name} (${formatUkDate(String(bill.next_due_date))})`)
            .join(', ')}.`
        );
      }
    }

    if (prefs.calendar?.enabled !== false) {
      const myEvents = todaysEvents.filter(
        (event) => !event.assigned_to || event.assigned_to === member.id
      );
      if (myEvents.length > 0) {
        parts.push(`Events: ${myEvents.map(calendarLine).join(', ')}.`);
      }
    }

    if (parts.length === 0) continue;

    const deliveryKey = `daily_brief_${member.id}_${now.date}`;
    const claimed = await claimDelivery(householdId, deliveryKey);
    if (!claimed) continue;

    const body = parts.join(' ');
    try {
      await notify(member.id, {
        title: 'Today at home',
        body,
        url: '/dashboard',
      });
      result.briefs += 1;
    } catch (error) {
      await releaseDelivery(householdId, deliveryKey);
      console.error(`Could not send daily brief to ${member.id}`, error);
    }
  }
}

async function sendChoreReminders(
  householdId: string,
  members: User[],
  settings: ReminderSettings,
  now: ReturnType<typeof londonNow>,
  result: ReminderRunResult
): Promise<void> {
  const [instances, templates] = await Promise.all([
    listChoreInstances(householdId, { status: 'pending' }),
    listChoreTemplates(householdId),
  ]);
  const templateMap = new Map(templates.map((template) => [template.id, template]));
  const memberMap = new Map(members.map((member) => [member.id, member]));

  for (const instance of instances) {
    if (!instance.assigned_to) continue;
    const member = memberMap.get(instance.assigned_to);
    if (!member) continue;
    const prefs = prefsFor(member);
    if (prefs.chores?.enabled === false) continue;
    if (quietNow(member, settings, now.time)) continue;

    const template = templateMap.get(instance.template_id);
    if (!template || template.reminder_mode === 'none') continue;

    const dueTime = instance.due_time ?? template.due_time ?? null;
    let reminderDate = instance.due_date;
    let reminderTime = '09:00';

    if (template.reminder_mode === 'before_due') {
      const shifted = shiftLocalDateTime(
        instance.due_date,
        dueTime ?? '23:59',
        -(template.reminder_offset_minutes ?? 0)
      );
      reminderDate = shifted.date;
      reminderTime = shifted.time;
    } else {
      reminderTime = template.reminder_time ?? dueTime ?? '09:00';
    }

    const reminderLocal = `${reminderDate}T${reminderTime}`;
    if (now.dateTime < reminderLocal) continue;
    if (now.dateTime > `${addDays(instance.due_date, 1)}T00:00`) continue;

    const deliveryKey = `chore_reminder_${instance.id}_${instance.due_date}_${member.id}`;
    const claimed = await claimDelivery(householdId, deliveryKey);
    if (!claimed) continue;

    try {
      await notify(member.id, {
        title: 'Chore reminder',
        body: `${instance.template_name ?? 'Task'} is due ${
          dueTime ? `at ${dueTime}` : formatUkDate(instance.due_date)
        }.`,
        url: '/chores',
      });
      result.chores += 1;
    } catch (error) {
      await releaseDelivery(householdId, deliveryKey);
      console.error(`Could not send chore reminder to ${member.id}`, error);
    }
  }
}

async function sendBinReminders(
  householdId: string,
  members: User[],
  settings: ReminderSettings,
  now: ReturnType<typeof londonNow>,
  result: ReminderRunResult
): Promise<void> {
  const bins = (await binsTonight(householdId)).filter((bin) => !bin.put_out_at);
  if (bins.length === 0) return;

  for (const member of members) {
    const prefs = prefsFor(member);
    if (prefs.bins?.enabled === false) continue;
    if (quietNow(member, settings, now.time)) continue;

    const groups = new Map<string, typeof bins>();
    bins.forEach((bin) => {
      const time =
        prefs.bins?.time ??
        bin.reminder_time ??
        settings.bins_reminder_time;
      groups.set(time, [...(groups.get(time) ?? []), bin]);
    });

    for (const [time, group] of Array.from(groups.entries())) {
      if (now.time < time) continue;
      const claimedKeys: string[] = [];
      for (const bin of group) {
        const key = `bin_reminder_${bin.id}_${bin.next_collection}_${member.id}`;
        if (await claimDelivery(householdId, key)) claimedKeys.push(key);
      }
      if (claimedKeys.length === 0) continue;

      try {
        await notify(member.id, {
          title: 'Bins out tonight',
          body: group.map((bin) => bin.name).join(', '),
          url: '/bins',
        });
        result.bins += 1;
      } catch (error) {
        await Promise.all(
          claimedKeys.map((key) => releaseDelivery(householdId, key))
        );
        console.error(`Could not send bin reminder to ${member.id}`, error);
      }
    }
  }
}

async function sendBillReminders(
  householdId: string,
  members: User[],
  settings: ReminderSettings,
  now: ReturnType<typeof londonNow>,
  result: ReminderRunResult
): Promise<void> {
  const bills = await listBills(householdId);

  for (const bill of bills) {
    if (!bill.next_due_date) continue;
    for (const member of members) {
      const prefs = prefsFor(member);
      if (prefs.bills?.enabled === false) continue;
      if (quietNow(member, settings, now.time)) continue;

      const days =
        prefs.bills?.days_before ??
        bill.reminder_days_before ??
        settings.bill_reminder_days;
      const time =
        prefs.bills?.time ?? bill.reminder_time ?? settings.bill_reminder_time;
      const reminderDate = addDays(bill.next_due_date, -days);
      if (now.date < reminderDate || now.date > bill.next_due_date) continue;
      if (now.time < time) continue;

      const deliveryKey = `bill_reminder_${bill.id}_${bill.next_due_date}_${member.id}`;
      const claimed = await claimDelivery(householdId, deliveryKey);
      if (!claimed) continue;

      try {
        await notify(member.id, {
          title: 'Bill due soon',
          body: `${bill.name} is due ${formatUkDate(bill.next_due_date)}${
            bill.amount_pence ? ` (${(bill.amount_pence / 100).toFixed(2)} GBP)` : ''
          }.`,
          url: '/bills',
        });
        result.bills += 1;
      } catch (error) {
        await releaseDelivery(householdId, deliveryKey);
        console.error(`Could not send bill reminder to ${member.id}`, error);
      }
    }
  }
}

async function sendCalendarReminders(
  householdId: string,
  members: User[],
  settings: ReminderSettings,
  now: ReturnType<typeof londonNow>,
  result: ReminderRunResult
): Promise<void> {
  const events = await listCalendarEvents(householdId);

  for (const event of events) {
    const start = new Date(event.start_time);
    const startDate = londonDateString(start);
    const startTime = event.all_day ? '09:00' : londonNow(start).time;
    const startLocal = `${startDate}T${startTime}`;
    if (now.dateTime > startLocal) continue;

    for (const member of members) {
      if (event.assigned_to && event.assigned_to !== member.id) continue;
      const prefs = prefsFor(member);
      if (prefs.calendar?.enabled === false) continue;
      if (quietNow(member, settings, now.time)) continue;

      const minutes =
        event.reminder_minutes_before ??
        prefs.calendar?.minutes_before ??
        settings.calendar_reminder_minutes;
      const shifted = shiftLocalDateTime(startDate, startTime, -minutes);
      const reminderLocal = `${shifted.date}T${shifted.time}`;
      if (now.dateTime < reminderLocal) continue;

      const deliveryKey = `calendar_reminder_${event.id}_${startLocal}_${member.id}`;
      const claimed = await claimDelivery(householdId, deliveryKey);
      if (!claimed) continue;

      try {
        await notify(member.id, {
          title: 'Calendar reminder',
          body: `${event.title} starts ${event.all_day ? 'today' : `at ${startTime}`}.`,
          url: '/calendar',
        });
        result.calendar += 1;
      } catch (error) {
        await releaseDelivery(householdId, deliveryKey);
        console.error(`Could not send calendar reminder to ${member.id}`, error);
      }
    }
  }
}

export async function runReminders(): Promise<ReminderRunResult> {
  const result: ReminderRunResult = {
    briefs: 0,
    chores: 0,
    bins: 0,
    bills: 0,
    calendar: 0,
  };
  const now = londonNow();
  const households = await dbAdmin().collection('households').get();

  for (const household of households.docs) {
    const householdId = household.id;
    try {
      const settings = householdSettings(household.data().reminder_settings);
      const members = await listMembers(householdId);
      if (members.length === 0) continue;
      await sendBriefs(householdId, members, settings, now, result);
      await sendChoreReminders(householdId, members, settings, now, result);
      await sendBinReminders(householdId, members, settings, now, result);
      await sendBillReminders(householdId, members, settings, now, result);
      await sendCalendarReminders(householdId, members, settings, now, result);
    } catch (error) {
      console.error(`Could not run reminders for household ${householdId}`, error);
    }
  }

  return result;
}
