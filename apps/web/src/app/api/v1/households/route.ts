import {
  createHousehold,
  getHousehold,
  householdUpdateSchema,
  moveUserToHousehold,
  requireSameOrigin,
  requireUserHousehold,
  route,
  updateHousehold,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    return Response.json(await getHousehold(householdId));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user } = await requireUserHousehold(request);
    const body = (await request.json()) as { name?: string; house_type?: string };
    const created = await createHousehold(body.name || 'My household', body.house_type);
    await moveUserToHousehold(user.id, created.id, 'admin');
    return Response.json(await getHousehold(created.id));
  });
}

export async function PUT(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, householdUpdateSchema);
    return Response.json(await updateHousehold(householdId, data));
  });
}
