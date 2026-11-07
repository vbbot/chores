import {
  londonToday,
  listMealPlan,
  requireSameOrigin,
  requireUserHousehold,
  route,
  upsertMealPlanEntry,
  mealPlanUpsertSchema,
} from '@chores/server';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    const url = new URL(request.url);
    const today = londonToday();
    const from = url.searchParams.get('from') || today;
    if (!DATE.test(from)) {
      return Response.json({ detail: 'Invalid date range' }, { status: 400 });
    }
    const to = url.searchParams.get('to') || addDays(from, 6);
    if (!DATE.test(to) || to < from) {
      return Response.json({ detail: 'Invalid date range' }, { status: 400 });
    }
    return Response.json(await listMealPlan(householdId, from, to));
  });
}

export async function PUT(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const { householdId } = await requireUserHousehold(request);
    const data = await parseBody(request, mealPlanUpsertSchema);
    return Response.json(await upsertMealPlanEntry(householdId, data));
  });
}
