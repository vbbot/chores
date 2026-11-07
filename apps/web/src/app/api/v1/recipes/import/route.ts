import {
  importRecipeFromUrl,
  recipeImportSchema,
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
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, recipeImportSchema);
    return Response.json(
      await importRecipeFromUrl(householdId, user.id, data.url)
    );
  });
}
