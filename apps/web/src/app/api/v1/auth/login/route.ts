import {
  ApiError,
  assertAltcha,
  createSessionCookie,
  getUser,
  rateLimit,
  requestIsSecure,
  requireSameOrigin,
  route,
  sessionCookie,
  signInWithPassword,
} from '@chores/server';
import { loginSchema } from '@chores/domain';
import { parseBody } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  return route(async () => {
    requireSameOrigin(request);
    const data = await parseBody(request, loginSchema);
    await assertAltcha(data.altcha);
    rateLimit(request, 'auth');

    const identity = await signInWithPassword(data.email, data.password);
    const user = await getUser(identity.localId);
    if (!user) throw new ApiError('Incorrect email or password', 401);

    const cookie = await createSessionCookie(identity.idToken);
    return Response.json(
      { access_token: '', token_type: 'cookie', user },
      { headers: { 'Set-Cookie': sessionCookie(cookie, requestIsSecure(request)) } }
    );
  });
}
