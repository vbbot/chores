import {
  ApiError,
  choreInstanceFilterSchema,
  firstZodError,
  listChoreInstances,
  requireUserHousehold,
  route,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const { householdId } = await requireUserHousehold(request);
    const url = new URL(request.url);
    const parsed = choreInstanceFilterSchema.safeParse({
      status: url.searchParams.get('status') ?? undefined,
      due_date: url.searchParams.get('due_date') ?? undefined,
      due_before: url.searchParams.get('due_before') ?? undefined,
      assigned_to: url.searchParams.get('assigned_to') ?? undefined,
      unassigned: url.searchParams.get('unassigned') ?? undefined,
      task_type: url.searchParams.get('task_type') ?? undefined,
    });
    if (!parsed.success) throw new ApiError(firstZodError(parsed.error), 400);
    return Response.json(await listChoreInstances(householdId, parsed.data));
  });
}
