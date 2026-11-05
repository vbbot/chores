import {
  completeChore,
  completeChoreSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, completeChoreSchema);
    const result = await completeChore(householdId, params.id, user.id, data.notes);
    return Response.json({ id: params.id, status: 'completed', ...result });
  });
}
