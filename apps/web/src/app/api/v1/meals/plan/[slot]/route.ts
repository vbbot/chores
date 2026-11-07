import {
  deleteMealPlanEntry,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(
  request: Request,
  { params }: { params: { slot: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    await deleteMealPlanEntry(householdId, params.slot);
    return Response.json({ message: 'Planned meal removed' });
  });
}
