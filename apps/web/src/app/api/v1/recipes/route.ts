import {
  createHouseholdRecipe,
  householdRecipeCreateSchema,
  requireSameOrigin,
  requireUserHousehold,
  recipeSearchSchema,
  route,
  searchRecipes,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    const url = new URL(request.url);
    const parsed = recipeSearchSchema.safeParse({
      q: url.searchParams.get('q') ?? '',
      max_time: url.searchParams.get('max_time') ?? undefined,
      page: url.searchParams.get('page') ?? undefined,
    });
    if (!parsed.success) {
      return Response.json({ detail: 'Invalid search' }, { status: 400 });
    }
    const items = await searchRecipes(householdId, parsed.data.q, {
      maxTime: parsed.data.max_time,
      page: parsed.data.page,
    });
    return Response.json({ items, page: parsed.data.page });
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, householdRecipeCreateSchema);
    return Response.json(await createHouseholdRecipe(householdId, user.id, data));
  });
}
