import {
  deleteHouseholdRecipe,
  getRecipe,
  householdRecipeUpdateSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
  updateHouseholdRecipe,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    const source = new URL(request.url).searchParams.get('source') ?? 'catalogue';
    return Response.json(await getRecipe(householdId, source, params.id));
  });
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, householdRecipeUpdateSchema);
    return Response.json(await updateHouseholdRecipe(householdId, params.id, data));
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    await deleteHouseholdRecipe(householdId, params.id);
    return Response.json({ message: 'Recipe deleted' });
  });
}
