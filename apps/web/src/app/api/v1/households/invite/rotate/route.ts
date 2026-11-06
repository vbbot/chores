import {
  ApiError,
  requireSameOrigin,
  requireUserHousehold,
  rotateInviteCode,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    if (user.role !== 'admin') {
      throw new ApiError('Only an admin can rotate the invite code', 403);
    }
    return Response.json({ invite_code: await rotateInviteCode(householdId) });
  });
}
