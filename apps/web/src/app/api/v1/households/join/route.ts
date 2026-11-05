import {
  getHousehold,
  householdByInviteCode,
  joinHouseholdSchema,
  moveUserToHousehold,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    const data = await parseBody(request, joinHouseholdSchema);
    const householdId = await householdByInviteCode(data.invite_code);
    await moveUserToHousehold(user.id, householdId, 'member');
    return Response.json(await getHousehold(householdId));
  });
}
