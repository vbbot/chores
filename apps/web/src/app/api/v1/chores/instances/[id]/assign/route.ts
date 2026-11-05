import {
  assignChore,
  assignChoreSchema,
  requireSameOrigin,
  requireUserHousehold,
  route,
  sendAssignmentNotification,
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
    const data = await parseBody(request, assignChoreSchema);
    const result = await assignChore(
      householdId,
      params.id,
      data.assigned_to,
      user.id
    );

    if (
      result.assigned_to &&
      result.assigned_to !== result.previously_assigned_to &&
      result.assigned_to !== user.id
    ) {
      try {
        await sendAssignmentNotification({
          userId: result.assigned_to,
          choreName: result.template_name,
          dueDate: result.due_date,
          assignedByName: user.name,
        });
      } catch (error) {
        console.error('Could not send assignment notification', error);
      }
    }

    return Response.json({ id: params.id, ...result });
  });
}
