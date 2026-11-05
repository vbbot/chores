import type { User } from '@chores/domain';

import { authAdmin, dbAdmin } from './firebase';
import { ApiError } from './http';

export const SESSION_COOKIE = '__session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

function parseCookies(header: string | null): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const index = part.indexOf('=');
      const key = index >= 0 ? part.slice(0, index).trim() : part.trim();
      const value = index >= 0 ? part.slice(index + 1).trim() : '';
      return [key, decodeURIComponent(value)];
    })
  );
}

export function requestIsSecure(request: Request): boolean {
  if (process.env.SESSION_COOKIE_SECURE === 'true') return true;
  const proto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  return proto === 'https';
}

export function sessionCookie(token: string, secure = false): string {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
    secure ? 'Secure' : '',
  ]
    .filter(Boolean)
    .join('; ');
}

export function clearedSessionCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function createSessionCookie(idToken: string): Promise<string> {
  return authAdmin().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_SECONDS * 1000,
  });
}

export async function userFromRequest(request: Request): Promise<User> {
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : null;
  const cookie = parseCookies(request.headers.get('cookie'))[SESSION_COOKIE];

  if (!bearer && !cookie) {
    throw new ApiError('Could not validate credentials', 401);
  }

  let uid: string;
  try {
    if (bearer) {
      const decoded = await authAdmin().verifyIdToken(bearer, true);
      uid = decoded.uid;
    } else {
      const decoded = await authAdmin().verifySessionCookie(cookie!, true);
      uid = decoded.uid;
    }
  } catch {
    throw new ApiError('Could not validate credentials', 401);
  }

  const user = await userProfile(uid);
  if (!user) throw new ApiError('Could not validate credentials', 401);
  return user;
}

export async function userProfile(uid: string): Promise<User | null> {
  const doc = await dbAdmin().collection('users').doc(uid).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<User, 'id'>) };
}

export async function currentHouseholdId(user: User): Promise<string> {
  if (!user.household_id) {
    throw new ApiError('User does not belong to a household yet', 400);
  }
  return user.household_id;
}

export async function requireUserHousehold(
  request: Request
): Promise<{ user: User; householdId: string }> {
  const user = await userFromRequest(request);
  return { user, householdId: await currentHouseholdId(user) };
}

export async function revokeSessions(uid: string): Promise<void> {
  await authAdmin().revokeRefreshTokens(uid);
}
