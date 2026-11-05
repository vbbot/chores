import { listNotifications, requireUserHousehold, route } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { user } = await requireUserHousehold(request);
    return Response.json(await listNotifications(user.id));
  });
}
