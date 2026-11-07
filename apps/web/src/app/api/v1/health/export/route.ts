import { exportHealthDiary, route, userFromRequest } from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return route(async () => {
    const user = await userFromRequest(request);
    const diary = await exportHealthDiary(user.id);
    return new Response(JSON.stringify(diary, null, 2), {
      headers: {
        'content-type': 'application/json',
        'content-disposition': 'attachment; filename="health-diary.json"',
      },
    });
  });
}
