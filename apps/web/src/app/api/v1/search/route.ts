import { requireUserHousehold, route, searchHousehold } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    const query = new URL(request.url).searchParams.get('q') ?? '';
    return Response.json(await searchHousehold(householdId, query));
  });
}
