import { householdProgress, requireUserHousehold, route } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { user, householdId } = await requireUserHousehold(request);
    return Response.json(await householdProgress(householdId, user.id));
  });
}
