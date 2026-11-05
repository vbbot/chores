import {
  deleteNote,
  noteUpdateSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
  updateNote,
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
    const data = await parseBody(request, noteUpdateSchema);
    return Response.json(await updateNote(householdId, params.id, data));
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    await deleteNote(householdId, params.id);
    return Response.json({ message: 'Note deleted' });
  });
}
