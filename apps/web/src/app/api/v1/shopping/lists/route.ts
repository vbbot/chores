import {
  createShoppingList,
  listShoppingLists,
  requireSameOrigin,
  requireUserHousehold,
  route,
  shoppingListCreateSchema,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    return Response.json(await listShoppingLists(householdId));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, shoppingListCreateSchema);
    return Response.json(await createShoppingList(householdId, data.name));
  });
}
