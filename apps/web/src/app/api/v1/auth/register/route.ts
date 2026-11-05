import {
  assertAltcha,
  createSessionCookie,
  registerAccount,
  rateLimit,
  requestIsSecure,
  requireSameOrigin,
  route,
  sessionCookie,
} from '@chores/server';
import { registerSchema } from '@chores/domain';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const data = await parseBody(request, registerSchema);
    await assertAltcha(data.altcha);
    rateLimit(request, 'auth');
    const { user, idToken } = await registerAccount(data);
    const cookie = await createSessionCookie(idToken);

    return Response.json(
      { access_token: '', token_type: 'cookie', user },
      { headers: { 'Set-Cookie': sessionCookie(cookie, requestIsSecure(request)) } }
    );
  });
}
