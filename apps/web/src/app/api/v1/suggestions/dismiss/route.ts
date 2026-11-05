import {
  dismissSuggestion,
  requireSameOrigin,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const body = (await request.json()) as { id?: string };
    if (!body.id) {
      return Response.json({ detail: 'Suggestion id is required' }, { status: 400 });
    }
    await dismissSuggestion(householdId, body.id);
    return Response.json({ message: 'Suggestion dismissed' });
  });
}
