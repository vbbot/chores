import {
  addPlannedMealToShopping,
  mealShoppingSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { slot: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, mealShoppingSchema);
    return Response.json(
      await addPlannedMealToShopping(householdId, user.id, params.slot, data.list_id)
    );
  });
}
