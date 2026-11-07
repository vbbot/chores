import {
  createHealthEntry,
  deleteAllHealthData,
  getHealthDiary,
  healthEntryCreateSchema,
  requireSameOrigin,
  route,
  userFromRequest,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const user = await userFromRequest(request);
    return Response.json(await getHealthDiary(user.id));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const user = await userFromRequest(request);
    const data = await parseBody(request, healthEntryCreateSchema);
    return Response.json(await createHealthEntry(user.id, data));
  });
}

export async function DELETE(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const user = await userFromRequest(request);
    await deleteAllHealthData(user.id);
    return Response.json({ message: 'Health diary deleted' });
  });
}
