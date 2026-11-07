import {
  requireSameOrigin,
  requireUserHousehold,
  route,
  toggleMealIdeaVote,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    return Response.json(await toggleMealIdeaVote(householdId, params.id, user.id));
  });
}
