'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { CalendarEvent } from '@/lib/types';

export default function CalendarPage() {
  const [events, setEvents] = React.useState<CalendarEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form
  const [title, setTitle] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const loadEvents = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<CalendarEvent[]>('/api/calendar/events');
      setEvents(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load calendar events');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadEvents();
  }, []);

  const openCreateDialog = () => {
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const newEvent = await apiFetch<CalendarEvent>('/api/calendar/events', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          start_time: new Date(startTime).toISOString(),
        }),
      });
      setEvents((prev) =>
        [...prev, newEvent].sort((a, b) => a.start_time.localeCompare(b.start_time))
      );
      setDialogOpen(false);
      setTitle('');
      setStartTime('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Delete this calendar event?')) return;
    setError(null);
    try {
      await apiFetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
      setEvents((prev) => prev.filter((event) => event.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Shared calendar</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household events...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Shared calendar</h1>
          <p className="text-sm text-secondary">
            Household schedule, visits, and chore reminders.
          </p>
        </div>
        <div className="flex space-x-2">
          <Link href="/settings">
            <Button variant="secondary" className="text-xs">
              iCal Feed
            </Button>
          </Link>
          <Button onClick={openCreateDialog}>Add event</Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {error}
        </div>
      )}

      {events.length === 0 ? (
        <EmptyState
          title="No upcoming events"
          description="Schedule plumber visits, boiler services, holidays, or shared commitments."
          actionLabel="Add household event"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-2">
          {events.map((ev) => (
            <Card key={ev.id} className="border-2">
              <CardContent className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-base">{ev.title}</h3>
                  <p className="text-xs text-secondary mt-0.5">
                    {new Date(ev.start_time).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <button
                  onClick={() => deleteEvent(ev.id)}
                  className="text-xs text-secondary hover:text-destructive p-1"
                >
                  Remove
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add calendar event">
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
            <label htmlFor="ev_title" className="block text-sm font-medium mb-1">
              Event title
            </label>
            <Input
              id="ev_title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Boiler service inspection"
            />
          </div>

          <div>
            <label htmlFor="ev_start" className="block text-sm font-medium mb-1">
              Date & Time
            </label>
            <Input
              id="ev_start"
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save event'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
