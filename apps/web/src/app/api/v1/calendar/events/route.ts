import {
  calendarEventCreateSchema,
  createCalendarEvent,
  listCalendarEvents,
  requireSameOrigin,
  requireUserHousehold,
  route,
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
    return Response.json(await createCalendarEvent(householdId, user.id, data));
  });
}
