import {
  calendarEventCreateSchema,
  createCalendarEvent,
  listCalendarEvents,
  requireSameOrigin,
  requireUserHousehold,
  route,
  sendCalendarEventNotification,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    return Response.json(await listCalendarEvents(householdId));
  });
}

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { user, householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, calendarEventCreateSchema);
    const event = await createCalendarEvent(householdId, user.id, data);

    try {
      await sendCalendarEventNotification({
        householdId,
        actorId: user.id,
        actorName: user.name,
        event,
      });
    } catch (error) {
      console.error('Could not send calendar event notification', error);
    }

    return Response.json(event);
  });
}
