import {
  createRoom,
  requireSameOrigin,
  requireUserHousehold,
  roomCreateSchema,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, roomCreateSchema);
    return Response.json(await createRoom(householdId, data));
  });
}
