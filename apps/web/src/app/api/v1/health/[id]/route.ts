import {
  deleteHealthEntry,
  healthEntryUpdateSchema,
  requireSameOrigin,
  route,
  updateHealthEntry,
  userFromRequest,
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
    const user = await userFromRequest(request);
    const data = await parseBody(request, healthEntryUpdateSchema);
    return Response.json(await updateHealthEntry(user.id, params.id, data));
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const user = await userFromRequest(request);
    await deleteHealthEntry(user.id, params.id);
    return Response.json({ message: 'Health entry deleted' });
  });
}
