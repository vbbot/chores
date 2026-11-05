import { randomUUID } from 'node:crypto';

import type { Notification } from '@chores/domain';

import { dbAdmin, messagingAdmin } from './firebase';
import { binsTonight } from './bins';
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

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const result = await notificationsCollection(userId).where('is_read', '==', false).get();
  const batch = dbAdmin().batch();
  result.docs.forEach((doc) => batch.update(doc.ref, { is_read: true }));
  await batch.commit();
}

export async function addNotification(
  userId: string,
  input: { type: string; title: string; body: string; data?: Record<string, unknown> | null }
): Promise<void> {
  await notificationsCollection(userId).doc(randomUUID()).set({
    user_id: userId,
    type: input.type,
    title: input.title,
    body: input.body,
    data: input.data ?? null,
    is_read: false,
    created_at: new Date().toISOString(),
  });
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
