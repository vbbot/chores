import {
  clearedSessionCookie,
  requireSameOrigin,
  revokeSessions,
  route,
  userFromRequest,
} from '@chores/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const user = await userFromRequest(request).catch(() => null);
    if (user) await revokeSessions(user.id);

    return Response.json(
      { message: 'Logged out successfully' },
      { headers: { 'Set-Cookie': clearedSessionCookie() } }
    );
  });
}
