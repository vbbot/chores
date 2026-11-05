import {
  deleteRoom,
  requireSameOrigin,
  requireUserHousehold,
  roomUpdateSchema,
  route,
  updateRoom,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, roomUpdateSchema);
    return Response.json(await updateRoom(householdId, params.id, data));
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    await deleteRoom(householdId, params.id);
    return Response.json({ message: 'Room deleted' });
  });
}
