import { randomBytes, randomUUID } from 'node:crypto';

import type { Household, ReminderSettings, Room, UserRole } from '@chores/domain';
import { DEFAULT_REMINDER_SETTINGS } from '@chores/domain';
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
  data: {
    name?: string;
    house_type?: string;
    reminder_settings?: Partial<ReminderSettings>;
  }
): Promise<Household> {
  const patch: Record<string, unknown> = {};
  if (data.name !== undefined) patch.name = data.name.trim();
  if (data.house_type !== undefined) patch.house_type = data.house_type;
  if (data.reminder_settings !== undefined) {
    const current = await householdDoc(householdId).get();
    patch.reminder_settings = {
      ...DEFAULT_REMINDER_SETTINGS,
      ...((current.data()?.reminder_settings as Partial<ReminderSettings>) ?? {}),
      ...data.reminder_settings,
    };
  }
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
    reminder_settings: DEFAULT_REMINDER_SETTINGS,
    created_at: new Date().toISOString(),
  });
  await batch.commit();
  return { id, inviteCode };
}

export async function rotateInviteCode(householdId: string): Promise<string> {
  const ref = householdDoc(householdId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Household not found', 404);
  const oldCode = String(doc.data()?.invite_code ?? '');
  const newCode = await uniqueInviteCode();
  const batch = dbAdmin().batch();
  if (oldCode) batch.delete(dbAdmin().collection('inviteCodes').doc(oldCode));
  batch.set(dbAdmin().collection('inviteCodes').doc(newCode), {
    household_id: householdId,
  });
  batch.update(ref, { invite_code: newCode });
  await batch.commit();
  return newCode;
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

export async function exportHouseholdData(householdId: string): Promise<Record<string, unknown>> {
  const collectionNames = [
    'rooms',
    'choreTemplates',
    'choreInstances',
    'suggestionDismissals',
    'binSchedules',
    'binExceptions',
    'binActions',
    'bills',
    'calendarEvents',
    'notes',
    'shoppingLists',
  ];

  const [household, members, ...collections] = await Promise.all([
    getHousehold(householdId),
    import('./users').then(({ listMembers }) => listMembers(householdId)),
    ...collectionNames.map((name) =>
      householdCollection(householdId, name).get().then((result) =>
        result.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
      )
    ),
  ]);

  const shoppingLists = collections[collectionNames.indexOf('shoppingLists')] as {
    id: string;
  }[];
  const shoppingWithItems = await Promise.all(
    shoppingLists.map(async (list) => {
      const items = await householdCollection(householdId, 'shoppingLists')
        .doc(list.id)
        .collection('items')
        .get();
      return {
        ...list,
        items: items.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      };
    })
  );

  const safeMembers = members.map((member) => {
    const { ical_token: _icalToken, ...safe } = member;
    return safe;
  });
  const data: Record<string, unknown> = { household, members: safeMembers };
  collectionNames.forEach((name, index) => {
    data[name] =
      name === 'shoppingLists' ? shoppingWithItems : collections[index];
  });
  return data;
}

export async function removeHouseholdMember(
  householdId: string,
  memberId: string,
  actorId: string,
  actorRole: UserRole
): Promise<void> {
  if (memberId !== actorId && actorRole !== 'admin') {
    throw new ApiError('Only an admin can remove another member', 403);
  }

  const { listMembers, clearHouseholdClaim, updateHouseholdClaim } = await import(
    './users'
  );
  const members = await listMembers(householdId);
  const member = members.find((item) => item.id === memberId);
  if (!member) throw new ApiError('Member not found', 404);
  if (members.length === 1) {
    throw new ApiError('A household needs at least one member', 400);
  }

  const remaining = members.filter((item) => item.id !== memberId);
  const newAdmin =
    member.role === 'admin'
      ? remaining.find((item) => item.role === 'admin') ?? remaining[0]
      : null;

  const batch = dbAdmin().batch();
  batch.update(dbAdmin().collection('users').doc(memberId), {
    household_id: null,
    role: 'member',
  });
  if (newAdmin && newAdmin.role !== 'admin') {
    batch.update(dbAdmin().collection('users').doc(newAdmin.id), { role: 'admin' });
  }
  if (member.ical_token) {
    batch.delete(dbAdmin().collection('icalFeeds').doc(member.ical_token));
  }

  const instances = await householdCollection(householdId, 'choreInstances').get();
  instances.docs.forEach((doc) => {
    const data = doc.data();
    if (data.status === 'pending' && data.assigned_to === memberId) {
      batch.update(doc.ref, { assigned_to: null, assigned_at: null });
    }
  });

  const templates = await householdCollection(householdId, 'choreTemplates').get();
  templates.docs.forEach((doc) => {
    const data = doc.data();
    const patch: Record<string, unknown> = {};
    if (data.assignment_mode === 'fixed' && data.fixed_assignee_id === memberId) {
      patch.assignment_mode = 'balanced';
      patch.fixed_assignee_id = null;
    }
    if (Array.isArray(data.rotation_member_ids)) {
      patch.rotation_member_ids = data.rotation_member_ids.filter(
        (id: string) => id !== memberId
      );
    }
    if (Object.keys(patch).length > 0) batch.update(doc.ref, patch);
  });

  const events = await householdCollection(householdId, 'calendarEvents').get();
  events.docs.forEach((doc) => {
    if (doc.data().assigned_to === memberId) {
      batch.update(doc.ref, { assigned_to: null });
    }
  });

  await batch.commit();
  await clearHouseholdClaim(memberId);
  if (newAdmin && newAdmin.role !== 'admin') {
    await updateHouseholdClaim(newAdmin.id, householdId, 'admin');
  }
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
