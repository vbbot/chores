import { ApiError, generateDailyChores, route } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function requireCron(request: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new ApiError('CRON_SECRET is not configured', 500);
  if (request.headers.get('authorization') !== `Bearer ${expected}`) {
    throw new ApiError('Unauthorized', 401);
  }
}

export async function POST(request: Request) {
  return route(async () => {
    requireCron(request);
    return Response.json({ created: await generateDailyChores() });
  });
}
