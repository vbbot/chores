'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { Note } from '@/lib/types';

export default function NotesPage() {
  const [notes, setNotes] = React.useState<Note[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form
  const [title, setTitle] = React.useState('');
  const [content, setContent] = React.useState('');
  const [isPinned, setIsPinned] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const loadNotes = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Note[]>('/api/notes');
      setNotes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadNotes();
  }, []);

  const sortNotes = (items: Note[]) =>
    [...items].sort((a, b) => {
      if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
      return b.updated_at.localeCompare(a.updated_at);
    });

  const openCreateDialog = () => {
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const newNote = await apiFetch<Note>('/api/notes', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          is_pinned: isPinned,
        }),
      });
      setNotes((prev) => sortNotes([newNote, ...prev]));
      setDialogOpen(false);
      setTitle('');
      setContent('');
      setIsPinned(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save note');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!window.confirm('Delete this note? This cannot be undone.')) return;
    setError(null);
    try {
      await apiFetch(`/api/notes/${id}`, { method: 'DELETE' });
      setNotes((prev) => prev.filter((note) => note.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete note');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Household notes</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household notes...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Household notes</h1>
          <p className="text-sm text-secondary">
            Shared info: Wi-Fi codes, meter readings, council contacts, appliance info.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add note</Button>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {error}
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
        <div className="grid gap-3 sm:grid-cols-2">
          {notes.map((note) => (
            <Card key={note.id} className="border-2">
              <CardContent>
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-base flex items-center gap-1.5">
                    {note.is_pinned && (
                      <span className="text-xs bg-foreground text-background px-1.5 py-0.5 rounded-card">
                        Pinned
                      </span>
                    )}
                    {note.title}
                  </h3>
                  <button
                    onClick={() => deleteNote(note.id)}
                    className="text-xs text-secondary hover:text-destructive p-1"
                  >
                    Delete
                  </button>
                </div>
                {note.content && (
                  <p className="mt-2 whitespace-pre-wrap text-xs p-2 bg-surface rounded-card border border-border">
                    {note.content}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add household note">
        <form onSubmit={handleCreate} className="space-y-4">
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
              placeholder="e.g. Wi-Fi Password & Meter locations"
            />
          </div>

          <div>
            <label htmlFor="note_content" className="block text-sm font-medium mb-1">
              Details / Content
            </label>
            <textarea
              id="note_content"
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter details..."
              className="w-full px-3 py-2 border border-border rounded-card bg-background text-sm"
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
