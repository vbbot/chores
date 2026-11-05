import {
  requireSameOrigin,
  route,
  updateUser,
  userFromRequest,
} from '@chores/server';
import { userUpdateSchema } from '@chores/domain';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    return Response.json(await userFromRequest(request));
  });
}

export async function PUT(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const user = await userFromRequest(request);
    const data = await parseBody(request, userUpdateSchema);
    return Response.json(await updateUser(user.id, data));
  });
}
