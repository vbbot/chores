import {
  deleteMealIdea,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    await deleteMealIdea(householdId, params.id, user);
    return Response.json({ message: 'Meal idea deleted' });
  });
}
