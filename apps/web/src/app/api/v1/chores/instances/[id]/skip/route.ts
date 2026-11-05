import {
  completeChoreSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
  skipChore,
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
    const data = await parseBody(request, completeChoreSchema);
    await skipChore(householdId, params.id, data.notes);
    return Response.json({ id: params.id, status: 'skipped' });
  });
}
