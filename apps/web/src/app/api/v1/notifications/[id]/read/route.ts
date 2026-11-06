import {
  markNotificationRead,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    await markNotificationRead(user.id, params.id);
    return Response.json({ message: 'Notification read' });
  });
}
