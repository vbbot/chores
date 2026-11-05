import { markBinsOut, requireSameOrigin, requireUserHousehold, route } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    return Response.json(await markBinsOut(householdId, user.id));
  });
}
