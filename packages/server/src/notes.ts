import { randomUUID } from 'node:crypto';

import type { Note } from '@chores/domain';
import { sortNotes } from '@chores/domain';

import { householdCollection } from './households';
import { ApiError } from './http';

function noteFromDoc(id: string, data: Record<string, unknown>): Note {
  return { id, ...(data as unknown as Omit<Note, 'id'>) };
}

export async function listNotes(householdId: string): Promise<Note[]> {
  const result = await householdCollection(householdId, 'notes').get();
  return sortNotes(result.docs.map((doc) => noteFromDoc(doc.id, doc.data())));
}

export async function createNote(
  householdId: string,
  userId: string,
  input: { title: string; content?: string; is_pinned?: boolean; category?: string | null }
): Promise<Note> {
  const id = randomUUID();
  const now = new Date().toISOString();
  const note = {
    household_id: householdId,
    author_id: userId,
    title: input.title.trim(),
    content: input.content ?? '',
    is_pinned: input.is_pinned ?? false,
    category: input.category ?? null,
    created_at: now,
    updated_at: now,
  };
  await householdCollection(householdId, 'notes').doc(id).set(note);
  return { id, ...note };
}

export async function updateNote(
  householdId: string,
  noteId: string,
  input: Record<string, unknown>
): Promise<Note> {
  const ref = householdCollection(householdId, 'notes').doc(noteId);
  if (!(await ref.get()).exists) throw new ApiError('Note not found', 404);
  const patch: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    patch[key] = key === 'title' && typeof value === 'string' ? value.trim() : value;
  });
  patch.updated_at = new Date().toISOString();
  await ref.update(patch);
  return noteFromDoc(noteId, (await ref.get()).data() as Record<string, unknown>);
}

export async function deleteNote(householdId: string, noteId: string): Promise<void> {
  const ref = householdCollection(householdId, 'notes').doc(noteId);
  if (!(await ref.get()).exists) throw new ApiError('Note not found', 404);
  await ref.delete();
}
