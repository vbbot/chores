import {
  binScheduleUpdateSchema,
  deleteBinSchedule,
  requireSameOrigin,
  requireUserHousehold,
  route,
  updateBinSchedule,
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
    const data = await parseBody(request, binScheduleUpdateSchema);
    return Response.json(await updateBinSchedule(householdId, params.id, data));
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    await deleteBinSchedule(householdId, params.id);
    return Response.json({ message: 'Bin collection deleted' });
  });
}
