import {
  assignChore,
  assignChoreSchema,
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
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, assignChoreSchema);
    await assignChore(householdId, params.id, data.assigned_to);
    return Response.json({ id: params.id, assigned_to: data.assigned_to });
  });
}
