'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Note, User } from '@/lib/types';

function noteDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const day = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${day} at ${time}`;
}

export default function NotesPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { data, isLoading, error } = useApiQuery<Note[]>(queryKeys.notes, '/api/v1/notes');
  const membersQuery = useApiQuery<User[]>(queryKeys.members, '/api/v1/households/members');
  const notes = data ?? [];
  const members = membersQuery.data ?? [];
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [isPinned, setIsPinned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const openCreateDialog = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setIsPinned(false);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (note: Note) => {
    setEditingId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setIsPinned(note.is_pinned);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(editingId ? `/api/v1/notes/${editingId}` : '/api/v1/notes', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSubmitting(false);
    }
  };

  const copyNote = async (note: Note) => {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(note.content || note.title);
      setCopiedId(note.id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setActionError('Could not copy this note.');
    }
  };

  const deleteNote = async (id: string) => {
    if (!(await confirm('Delete this note? This cannot be undone.'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/notes/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.notes });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Household notes</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading household notes...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Household notes</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load notes.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Household notes</h1>
          <p className="text-sm text-secondary">
            Wi-Fi codes, meter readings, council contacts, and appliance info.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add note</Button>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load notes.')}
        </div>
      )}

      {notes.length === 0 ? (
        <EmptyState
          title="No shared notes yet"
          description="Keep Wi-Fi passwords, landlord details, and handy home notes in one place."
          actionLabel="Create first note"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-2">
          {notes.map((note) => {
            const author =
              note.author_id === user?.id
                ? 'You'
                : members.find((member) => member.id === note.author_id)?.name ??
                  'Someone';
            const created = noteDate(note.created_at);
            const updated = noteDate(note.updated_at);
            const edited =
              note.updated_at !== note.created_at
                ? updated && updated !== created
                  ? `Updated ${updated}`
                  : 'Updated'
                : null;

            return (
              <div
                key={note.id}
                id={`note-${note.id}`}
                className="border border-border rounded-card p-3 scroll-mt-24 target:bg-surface"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {note.is_pinned && (
                        <span className="text-xs font-semibold text-accent">Pinned</span>
                      )}
                      {note.title}
                    </h3>
                    <p className="text-xs text-secondary mt-1">
                      Added by {author} on {created ?? 'an unknown date'}
                      {edited ? ` • ${edited}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyNote(note)}
                      className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
                    >
                      {copiedId === note.id ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={() => openEditDialog(note)}
                      className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {note.content && (
                  <p className="mt-2 whitespace-pre-wrap text-sm">{note.content}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit household note' : 'Add household note'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {formError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="note_title" className="block text-sm font-medium mb-1">
              Title
            </label>
            <Input
              id="note_title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Wi-Fi Password and Meter Locations"
            />
          </div>

          <div>
            <label htmlFor="note_content" className="block text-sm font-medium mb-1">
              Details
            </label>
            <textarea
              id="note_content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter details..."
              className="w-full px-3 py-2 border border-border rounded-card bg-background text-base"
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="note_pin"
              checked={isPinned}
              onChange={(e) => setIsPinned(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="note_pin" className="text-sm font-medium">
              Pin to top of notes
            </label>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save note'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
