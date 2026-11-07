import {
  addRecipeToShopping,
  recipeShoppingSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, recipeShoppingSchema);
    return Response.json(
      await addRecipeToShopping(
        householdId,
        user.id,
        data.source,
        params.id,
        data.servings,
        data.list_id
      )
    );
  });
}
