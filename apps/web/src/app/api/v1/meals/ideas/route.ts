import {
  createMealIdea,
  listMealIdeas,
  mealIdeaCreateSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { user, householdId } = await requireUserHousehold(request);
    return Response.json(await listMealIdeas(householdId, user.id));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, mealIdeaCreateSchema);
    return Response.json(await createMealIdea(householdId, user.id, data));
  });
}
