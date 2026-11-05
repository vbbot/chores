import {
  markAllNotificationsRead,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    await markAllNotificationsRead(user.id);
    return Response.json({ message: 'All notifications marked as read' });
  });
}
