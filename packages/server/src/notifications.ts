import { randomUUID } from 'node:crypto';

import type { CalendarEvent, Notification } from '@chores/domain';
import { formatUkDate, londonToday } from '@chores/domain';

import { dbAdmin, messagingAdmin } from './firebase';
import { binsTonight } from './bins';
import { listChoreInstances } from './chores';
import { listMembers, deviceTokens, removeDeviceToken } from './users';

function notificationFromDoc(id: string, data: Record<string, unknown>): Notification {
  return { id, ...(data as unknown as Omit<Notification, 'id'>) };
}

function notificationsCollection(userId: string) {
  return dbAdmin().collection('users').doc(userId).collection('notifications');
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const result = await notificationsCollection(userId)
    .orderBy('created_at', 'desc')
    .limit(30)
    .get();
  return result.docs.map((doc) => notificationFromDoc(doc.id, doc.data()));
}

export async function markNotificationRead(
  userId: string,
  notificationId: string
): Promise<void> {
  await notificationsCollection(userId).doc(notificationId).update({ is_read: true });
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const result = await notificationsCollection(userId).where('is_read', '==', false).get();
  const batch = dbAdmin().batch();
  result.docs.forEach((doc) => batch.update(doc.ref, { is_read: true }));
  await batch.commit();
}

export async function addNotification(
  userId: string,
  input: { type: string; title: string; body: string; data?: Record<string, unknown> | null },
  options?: { id?: string }
): Promise<void> {
  await notificationsCollection(userId).doc(options?.id ?? randomUUID()).set({
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  });
}

export async function sendPushToUser(
  userId: string,
  input: { title: string; body: string; url: string }
): Promise<number> {
  const tokens = await deviceTokens(userId);
  if (tokens.length === 0) return 0;

  let sent = 0;
  for (let index = 0; index < tokens.length; index += 400) {
    const chunk = tokens.slice(index, index + 400);
    const response = await messagingAdmin().sendEachForMulticast({
      tokens: chunk,
      notification: { title: input.title, body: input.body },
      data: { url: input.url },
      webpush: {
        fcmOptions: { link: input.url },
        notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
      },
    });
    sent += response.successCount;

    await Promise.all(
      response.responses.map(async (result, resultIndex) => {
        const code = result.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          await removeDeviceToken(userId, chunk[resultIndex]);
        }
      })
    );
  }

  return sent;
}

function choreList(names: string[]): string {
  if (names.length <= 3) return names.join(', ');
  return `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
}

export async function sendChoreReminders(): Promise<number> {
  const today = londonToday();
  const households = await dbAdmin().collection('households').get();
  let sent = 0;

  for (const household of households.docs) {
    const householdId = household.id;
    const pending = await listChoreInstances(householdId, { status: 'pending' });
    const due = pending.filter((instance) => instance.due_date <= today);
    if (due.length === 0) continue;

    const members = await listMembers(householdId);
    const unassigned = due.filter((instance) => !instance.assigned_to);

    for (const member of members) {
      const mine = due.filter((instance) => instance.assigned_to === member.id);
      const parts: string[] = [];

      if (mine.length > 0) {
        const overdue = mine.filter((instance) => instance.due_date < today).length;
        parts.push(
          `${mine.length} chore${mine.length === 1 ? '' : 's'}: ${choreList(
            mine.map((instance) => instance.template_name ?? 'Task')
          )}.`
        );
        if (overdue > 0) {
          parts.push(`${overdue} overdue.`);
        }
      }

      if (unassigned.length > 0) {
        parts.push(
          `${unassigned.length} up for grabs: ${choreList(
            unassigned.map((instance) => instance.template_name ?? 'Task')
          )}.`
        );
      }

      if (parts.length === 0) continue;

      const title = mine.length > 0 ? "Today's chores" : 'Chores up for grabs';
      const body = parts.join(' ');
      try {
        await addNotification(
          member.id,
          {
            type: 'chore_reminder',
            title,
            body,
            data: { url: '/chores' },
          },
          { id: `chore_reminder_${today}` }
        );
        sent += await sendPushToUser(member.id, {
          title,
          body,
          url: '/chores',
        });
      } catch (error) {
        console.error(`Could not send chore reminder to ${member.id}`, error);
      }
    }
  }

  return sent;
}

export async function sendAssignmentNotification(input: {
  userId: string;
  choreName: string;
  dueDate: string;
  assignedByName: string;
}): Promise<void> {
  const title = 'Chore assigned to you';
  const body = `${input.assignedByName} assigned "${input.choreName}" to you for ${formatUkDate(
    input.dueDate
  )}.`;

  await addNotification(input.userId, {
    type: 'chore_assigned',
    title,
    body,
    data: { url: '/chores' },
  });
  await sendPushToUser(input.userId, { title, body, url: '/chores' });
}

function eventWhen(event: CalendarEvent): string {
  const date = new Date(event.start_time);
  const dateLabel = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  if (event.all_day) return dateLabel;
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${dateLabel} at ${time}`;
}

export async function sendCalendarEventNotification(input: {
  householdId: string;
  actorId: string;
  actorName: string;
  event: CalendarEvent;
}): Promise<number> {
  const members = await listMembers(input.householdId);
  const recipients = members.filter((member) => {
    if (member.id === input.actorId) return false;
    if (input.event.assigned_to) return member.id === input.event.assigned_to;
    return true;
  });

  const title = input.event.assigned_to
    ? 'Calendar event for you'
    : 'New household event';
  const body = `${input.actorName} added "${input.event.title}" for ${eventWhen(
    input.event
  )}.`;

  let sent = 0;
  for (const member of recipients) {
    try {
      await addNotification(member.id, {
        type: 'calendar_event',
        title,
        body,
        data: { url: '/calendar', event_id: input.event.id },
      });
      sent += await sendPushToUser(member.id, {
        title,
        body,
        url: '/calendar',
      });
    } catch (error) {
      console.error(`Could not send calendar notification to ${member.id}`, error);
    }
  }
  return sent;
}

export async function sendBinReminders(): Promise<number> {
  const households = await dbAdmin().collection('households').get();
  let sent = 0;

  for (const household of households.docs) {
    const householdId = household.id;
    const tonight = await binsTonight(householdId);
    const pending = tonight.filter((schedule) => !schedule.put_out_at);
    if (pending.length === 0) continue;

    const members = await listMembers(householdId);
    const tokens: { token: string; userId: string }[] = [];
    for (const member of members) {
      const memberTokens = await deviceTokens(member.id);
      memberTokens.forEach((token) => tokens.push({ token, userId: member.id }));
    }
    if (tokens.length === 0) continue;

    const title =
      pending.length === 1 ? 'Bin collection tomorrow' : 'Bin collections tomorrow';
    const body = pending.map((schedule) => `${schedule.name} (${schedule.colour})`).join(', ');

    for (let index = 0; index < tokens.length; index += 400) {
      const chunk = tokens.slice(index, index + 400);
      const response = await messagingAdmin().sendEachForMulticast({
        tokens: chunk.map((item) => item.token),
        notification: { title, body },
        data: { url: '/bins' },
        webpush: {
          fcmOptions: { link: '/bins' },
          notification: { icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' },
        },
      });
      sent += response.successCount;

      await Promise.all(
        response.responses.map(async (result, resultIndex) => {
          const code = result.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            await removeDeviceToken(chunk[resultIndex].userId, chunk[resultIndex].token);
          }
        })
      );
    }
  }

  return sent;
}
