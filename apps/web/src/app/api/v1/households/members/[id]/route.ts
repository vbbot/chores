import {
  removeHouseholdMember,
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
    await removeHouseholdMember(householdId, params.id, user.id, user.role);
    return Response.json({ message: 'Member removed' });
  });
}
