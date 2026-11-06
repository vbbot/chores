import {
  addNotification,
  requireSameOrigin,
  requireUserHousehold,
  route,
  sendPushToUser,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    const title = 'Chores test notification';
    const body = 'Notifications are working on this device.';
    await addNotification(user.id, {
      type: 'test',
      title,
      body,
      data: { url: '/settings' },
    });
    const sent = await sendPushToUser(user.id, {
      title,
      body,
      url: '/settings',
    });
    return Response.json({ sent });
  });
}
