import { randomBytes, randomUUID } from 'node:crypto';

import type { Household, Room, UserRole } from '@chores/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { dbAdmin } from './firebase';
import { ApiError } from './http';

export const householdsCollection = () => dbAdmin().collection('households');

export function householdDoc(householdId: string) {
  return householdsCollection().doc(householdId);
}

export function householdCollection(householdId: string, name: string) {
  return householdDoc(householdId).collection(name);
}

export function roomFromDoc(doc: DocumentSnapshot): Room {
  return { id: doc.id, ...(doc.data() as Omit<Room, 'id'>) };
}

export async function listRooms(householdId: string): Promise<Room[]> {
  const result = await householdCollection(householdId, 'rooms')
    .orderBy('sort_order', 'asc')
    .get();
  return result.docs.map(roomFromDoc);
}

export async function getHousehold(householdId: string): Promise<Household> {
  const doc = await householdDoc(householdId).get();
  if (!doc.exists) throw new ApiError('Household not found', 404);
  return {
    id: doc.id,
    ...(doc.data() as Omit<Household, 'id' | 'rooms'>),
    rooms: await listRooms(householdId),
  };
}

export async function updateHousehold(
  householdId: string,
  data: { name?: string; house_type?: string }
): Promise<Household> {
  const patch: Record<string, string> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.house_type !== undefined) patch.house_type = data.house_type;
  await householdDoc(householdId).update(patch);
  return getHousehold(householdId);
}

async function uniqueInviteCode(): Promise<string> {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    const existing = await dbAdmin().collection('inviteCodes').doc(code).get();
    if (!existing.exists) return code;
  }
  throw new ApiError('Could not create an invite code. Try again.', 500);
}

export async function createHousehold(
  name: string,
  houseType = 'terraced'
): Promise<{ id: string; inviteCode: string }> {
  const inviteCode = await uniqueInviteCode();
  const id = randomUUID();
  const batch = dbAdmin().batch();
  batch.set(dbAdmin().collection('inviteCodes').doc(inviteCode), { household_id: id });
  batch.set(householdDoc(id), {
    name: name.trim(),
    house_type: houseType,
    invite_code: inviteCode,
    created_at: new Date().toISOString(),
  });
  await batch.commit();
  return { id, inviteCode };
}

export async function householdByInviteCode(code: string): Promise<string> {
  const invite = await dbAdmin()
    .collection('inviteCodes')
    .doc(code.trim().toUpperCase())
    .get();
  if (!invite.exists) throw new ApiError('Invalid invite code', 404);
  return String(invite.data()?.household_id);
}

export async function moveUserToHousehold(
  uid: string,
  householdId: string,
  role: UserRole
): Promise<void> {
  const userRef = dbAdmin().collection('users').doc(uid);
  const user = await userRef.get();
  if (!user.exists) throw new ApiError('User profile not found', 404);

  const icalToken = user.data()?.ical_token;
  const batch = dbAdmin().batch();
  batch.update(userRef, { household_id: householdId, role });
  if (icalToken) {
    batch.set(
      dbAdmin().collection('icalFeeds').doc(icalToken),
      { household_id: householdId, user_id: uid },
      { merge: true }
    );
  }
  await batch.commit();
  const { updateHouseholdClaim } = await import('./users');
  await updateHouseholdClaim(uid, householdId, role);
}

export async function createUserProfile(input: {
  uid: string;
  name: string;
  email: string;
  householdId: string;
  role: UserRole;
  icalToken: string;
}): Promise<void> {
  await dbAdmin().collection('users').doc(input.uid).set({
    name: input.name.trim(),
    email: input.email.toLowerCase().trim(),
    household_id: input.householdId,
    role: input.role,
    notification_prefs: {},
    ical_token: input.icalToken,
    created_at: new Date().toISOString(),
  });
  await dbAdmin()
    .collection('icalFeeds')
    .doc(input.icalToken)
    .set({ household_id: input.householdId, user_id: input.uid });
}

export async function createRoom(
  householdId: string,
  data: {
    name: string;
    room_type?: string;
    floor?: number | null;
    sort_order?: number;
  }
): Promise<Room> {
  const id = randomUUID();
  const room = {
    household_id: householdId,
    name: data.name.trim(),
    room_type: data.room_type ?? 'other',
    floor: data.floor ?? null,
    sort_order: data.sort_order ?? 0,
  };
  await householdCollection(householdId, 'rooms').doc(id).set(room);
  return { id, ...room };
}

export async function createRoomsBulk(
  householdId: string,
  rooms: { name: string; room_type?: string; floor?: number | null; sort_order?: number }[]
): Promise<Room[]> {
  const batch = dbAdmin().batch();
  const created: Room[] = rooms.map((room) => {
    const id = randomUUID();
    const data = {
      household_id: householdId,
      name: room.name.trim(),
      room_type: room.room_type ?? 'other',
      floor: room.floor ?? null,
      sort_order: room.sort_order ?? 0,
    };
    batch.set(householdCollection(householdId, 'rooms').doc(id), data);
    return { id, ...data };
  });
  await batch.commit();
  return created;
}

export async function updateRoom(
  householdId: string,
  roomId: string,
  data: { name?: string; room_type?: string; floor?: number | null; sort_order?: number }
): Promise<Room> {
  const ref = householdCollection(householdId, 'rooms').doc(roomId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Room not found', 404);
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.room_type !== undefined) patch.room_type = data.room_type;
  if (data.floor !== undefined) patch.floor = data.floor;
  if (data.sort_order !== undefined) patch.sort_order = data.sort_order;
  await ref.update(patch);
  const updated = await ref.get();
  return roomFromDoc(updated);
}

export async function deleteRoom(householdId: string, roomId: string): Promise<void> {
  const ref = householdCollection(householdId, 'rooms').doc(roomId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Room not found', 404);
  await ref.delete();

  const templates = await householdCollection(householdId, 'choreTemplates')
    .where('room_id', '==', roomId)
    .get();
  const batch = dbAdmin().batch();
  templates.docs.forEach((template) => batch.update(template.ref, { room_id: null }));
  await batch.commit();
}

export async function icalFeed(token: string) {
  const doc = await dbAdmin().collection('icalFeeds').doc(token).get();
  return doc.exists ? (doc.data() as { household_id: string; user_id: string }) : null;
}

export function newIcalToken(): string {
  return randomBytes(24).toString('base64url');
}
