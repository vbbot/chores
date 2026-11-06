import type { User } from '@chores/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { authAdmin, dbAdmin } from './firebase';

export const usersCollection = () => dbAdmin().collection('users');

export function profileFromDoc(doc: DocumentSnapshot): User | null {
  if (!doc.exists) return null;
  return { id: doc.id, ...(doc.data() as Omit<User, 'id'>) };
}

export async function getUser(uid: string): Promise<User | null> {
  return profileFromDoc(await usersCollection().doc(uid).get());
}

export async function listMembers(householdId: string): Promise<User[]> {
  const result = await usersCollection().where('household_id', '==', householdId).get();
  return result.docs
    .map((doc) => profileFromDoc(doc))
    .filter((user): user is User => user !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function updateUser(
  uid: string,
  data: Partial<Pick<User, 'name' | 'notification_prefs'>>
): Promise<User> {
  await usersCollection().doc(uid).update(data);
  const user = await getUser(uid);
  if (!user) throw new Error('User profile missing after update');
  return user;
}

export async function addDeviceToken(
  uid: string,
  deviceId: string,
  data: { token: string; platform: string; endpoint?: string }
): Promise<void> {
  await usersCollection()
    .doc(uid)
    .collection('devices')
    .doc(deviceId)
    .set({ ...data, updated_at: new Date().toISOString() }, { merge: true });
}

export async function deviceTokens(uid: string): Promise<string[]> {
  const result = await usersCollection().doc(uid).collection('devices').get();
  return result.docs.map((doc) => String(doc.data().token)).filter(Boolean);
}

export async function removeDeviceToken(uid: string, token: string): Promise<void> {
  const result = await usersCollection()
    .doc(uid)
    .collection('devices')
    .where('token', '==', token)
    .get();
  await Promise.all(result.docs.map((doc) => doc.ref.delete()));
}

export async function updateHouseholdClaim(
  uid: string,
  householdId: string,
  role: string
): Promise<void> {
  await authAdmin().setCustomUserClaims(uid, { householdId, role });
}

export async function clearHouseholdClaim(uid: string): Promise<void> {
  await authAdmin().setCustomUserClaims(uid, {});
}

export function userRef(uid: string) {
  return usersCollection().doc(uid);
}
