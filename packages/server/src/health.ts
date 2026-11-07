import { randomUUID } from 'node:crypto';

import type { HealthDiary, HealthEntry, HealthSeverity } from '@chores/domain';

import { dbAdmin } from './firebase';
import { getUser, usersCollection } from './users';
import { ApiError } from './http';

function entriesCollection(userId: string) {
  return dbAdmin().collection('users').doc(userId).collection('healthEntries');
}

function entryFromDoc(id: string, data: Record<string, unknown>): HealthEntry {
  return { id, ...(data as Omit<HealthEntry, 'id'>) };
}

export async function getHealthDiary(userId: string): Promise<HealthDiary> {
  const [user, result] = await Promise.all([
    getUser(userId),
    entriesCollection(userId).orderBy('date', 'desc').get(),
  ]);
  return {
    consent_at: user?.health_consent_at ?? null,
    entries: result.docs
      .map((doc) => entryFromDoc(doc.id, doc.data()))
      .sort((a, b) =>
        `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
      ),
  };
}

export async function createHealthEntry(
  userId: string,
  input: {
    date: string;
    time: string;
    symptoms: string[];
    severity: number;
    duration_minutes?: number | null;
    energy?: number | null;
    notes?: string | null;
    consent: boolean;
  }
): Promise<HealthEntry> {
  const user = await getUser(userId);
  if (!user) throw new ApiError('User not found', 404);
  if (!user.health_consent_at && !input.consent) {
    throw new ApiError('Accept the health diary notice before saving an entry', 400);
  }
  if (!user.health_consent_at) {
    await usersCollection().doc(userId).update({
      health_consent_at: new Date().toISOString(),
    });
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  const entry = {
    user_id: userId,
    date: input.date,
    time: input.time,
    symptoms: input.symptoms,
    severity: input.severity as HealthSeverity,
    duration_minutes: input.duration_minutes ?? null,
    energy: (input.energy as HealthSeverity | null | undefined) ?? null,
    notes: input.notes?.trim() || null,
    created_at: now,
    updated_at: now,
  };
  await entriesCollection(userId).doc(id).set(entry);
  return { id, ...entry };
}

export async function updateHealthEntry(
  userId: string,
  entryId: string,
  patch: {
    date?: string;
    time?: string;
    symptoms?: string[];
    severity?: number;
    duration_minutes?: number | null;
    energy?: number | null;
    notes?: string | null;
  }
): Promise<HealthEntry> {
  const ref = entriesCollection(userId).doc(entryId);
  if (!(await ref.get()).exists) throw new ApiError('Health entry not found', 404);
  const update: Record<string, unknown> = {
    ...patch,
    updated_at: new Date().toISOString(),
  };
  if (patch.notes !== undefined) update.notes = patch.notes?.trim() || null;
  if (patch.severity !== undefined) update.severity = patch.severity as HealthSeverity;
  await ref.update(update);
  const doc = await ref.get();
  return entryFromDoc(entryId, doc.data() as Record<string, unknown>);
}

export async function deleteHealthEntry(
  userId: string,
  entryId: string
): Promise<void> {
  const ref = entriesCollection(userId).doc(entryId);
  if (!(await ref.get()).exists) throw new ApiError('Health entry not found', 404);
  await ref.delete();
}

export async function exportHealthDiary(userId: string): Promise<HealthDiary> {
  return getHealthDiary(userId);
}

export async function deleteAllHealthData(userId: string): Promise<void> {
  const result = await entriesCollection(userId).get();
  let batch = dbAdmin().batch();
  let count = 0;
  for (const doc of result.docs) {
    batch.delete(doc.ref);
    count += 1;
    if (count === 400) {
      await batch.commit();
      batch = dbAdmin().batch();
      count = 0;
    }
  }
  if (count > 0) await batch.commit();
  await usersCollection().doc(userId).update({ health_consent_at: null });
}
