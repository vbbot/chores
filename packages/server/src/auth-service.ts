import type { User, UserRole } from '@chores/domain';

import { authAdmin } from './firebase';
import {
  createHousehold,
  createUserProfile,
  householdByInviteCode,
  newIcalToken,
} from './households';
import { ApiError } from './http';
import { getUser, updateHouseholdClaim } from './users';

type IdentityUser = {
  localId: string;
  idToken: string;
  refreshToken: string;
};

function identityToolkitBase(): string {
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  return emulator
    ? `http://${emulator}/identitytoolkit.googleapis.com/v1`
    : 'https://identitytoolkit.googleapis.com/v1';
}

async function identityRequest(
  path: string,
  body: Record<string, unknown>
): Promise<IdentityUser> {
  const key = process.env.FIREBASE_WEB_API_KEY;
  if (!key) throw new ApiError('Firebase web API key is not configured', 500);

  const response = await fetch(`${identityToolkitBase()}/${path}?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as {
    localId?: string;
    idToken?: string;
    refreshToken?: string;
    error?: { message?: string };
  };

  if (!response.ok || !data.idToken || !data.localId) {
    throw new ApiError('Incorrect email or password', 401);
  }

  return {
    localId: data.localId,
    idToken: data.idToken,
    refreshToken: data.refreshToken ?? '',
  };
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<IdentityUser> {
  return identityRequest('accounts:signInWithPassword', {
    email: email.toLowerCase().trim(),
    password,
    returnSecureToken: true,
  });
}

export async function registerAccount(input: {
  name: string;
  email: string;
  password: string;
  household_name?: string;
  invite_code?: string;
}): Promise<{ user: User; idToken: string }> {
  let householdId: string;
  let role: UserRole;
  let createdHouseholdId: string | null = null;
  let createdInviteCode: string | null = null;

  if (input.invite_code) {
    householdId = await householdByInviteCode(input.invite_code);
    role = 'member';
  } else if (input.household_name) {
    const household = await createHousehold(input.household_name);
    householdId = household.id;
    createdHouseholdId = household.id;
    createdInviteCode = household.inviteCode;
    role = 'admin';
  } else {
    throw new ApiError('Enter a household name or an invite code', 400);
  }

  let uid: string | null = null;
  try {
    const created = await authAdmin().createUser({
      email: input.email.toLowerCase().trim(),
      password: input.password,
      displayName: input.name.trim(),
    });
    uid = created.uid;

    const icalToken = newIcalToken();
    await createUserProfile({
      uid,
      name: input.name,
      email: input.email,
      householdId,
      role,
      icalToken,
    });
    await updateHouseholdClaim(uid, householdId, role);

    const identity = await signInWithPassword(input.email, input.password);
    const user = await getUser(uid);
    if (!user) throw new ApiError('Could not create the user profile', 500);
    return { user, idToken: identity.idToken };
  } catch (error) {
    if (uid) {
      await authAdmin().deleteUser(uid).catch(() => undefined);
    }
    if (createdHouseholdId) {
      const { dbAdmin } = await import('./firebase');
      await dbAdmin().collection('households').doc(createdHouseholdId).delete().catch(() => undefined);
    }
    if (createdInviteCode) {
      const { dbAdmin } = await import('./firebase');
      await dbAdmin().collection('inviteCodes').doc(createdInviteCode).delete().catch(() => undefined);
    }
    if (error instanceof ApiError) throw error;
    if (
      error instanceof Error &&
      'code' in error &&
      (error as { code?: string }).code === 'auth/email-already-exists'
    ) {
      throw new ApiError('Email address already registered', 400);
    }
    throw error;
  }
}
