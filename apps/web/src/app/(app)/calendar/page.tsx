'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { CalendarEvent, User } from '@/lib/types';

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function localInputValue(value: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useApiQuery<CalendarEvent[]>(
    queryKeys.calendar,
    '/api/v1/calendar/events'
  );
  const events = data ?? [];
  const membersQuery = useApiQuery<User[]>(queryKeys.members, '/api/v1/households/members');
  const members = membersQuery.data ?? [];
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [startTime, setStartTime] = React.useState('');
  const [endTime, setEndTime] = React.useState('');
  const [allDay, setAllDay] = React.useState(false);
  const [assignedTo, setAssignedTo] = React.useState('');
  const [reminderMinutes, setReminderMinutes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setStartTime('');
    setEndTime('');
    setAllDay(false);
    setAssignedTo('');
    setReminderMinutes('');
    setFormError(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (event: CalendarEvent) => {
    setEditingId(event.id);
    setTitle(event.title);
    setStartTime(localInputValue(event.start_time));
    setEndTime(event.end_time ? localInputValue(event.end_time) : '');
    setAllDay(event.all_day);
    setAssignedTo(event.assigned_to ?? '');
    setReminderMinutes(
      event.reminder_minutes_before === null ||
        event.reminder_minutes_before === undefined
        ? ''
        : String(event.reminder_minutes_before)
    );
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !startTime) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(
        editingId
          ? `/api/v1/calendar/events/${editingId}`
          : '/api/v1/calendar/events',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify({
            title: title.trim(),
            start_time: new Date(startTime).toISOString(),
            end_time: endTime ? new Date(endTime).toISOString() : null,
            all_day: allDay,
            assigned_to: assignedTo || null,
            reminder_minutes_before:
              reminderMinutes === '' ? null : Number(reminderMinutes),
          }),
        }
      );
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save event');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEvent = async (id: string) => {
    if (!window.confirm('Delete this calendar event?')) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/calendar/events/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.calendar });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete event');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Shared calendar</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading household events...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Shared calendar</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load events.'}
        </div>
      </div>
    );
  }

  const today = londonDateString();
  const groups = new Map<string, CalendarEvent[]>();
  events.forEach((event) => {
    const date = londonDateString(new Date(event.start_time));
    groups.set(date, [...(groups.get(date) ?? []), event]);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Shared calendar</h1>
          <p className="text-sm text-secondary">
            Household schedule, visits, and shared commitments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/settings"
            className="text-sm text-secondary underline hover:text-foreground min-h-[44px] inline-flex items-center"
          >
            iCal feed
          </Link>
          <Button onClick={openCreateDialog}>Add event</Button>
        </div>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load events.')}
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
        <div className="space-y-7">
          {Array.from(groups.entries()).map(([date, items]) => (
            <section key={date} className="space-y-2">
              <h2
                className={`text-sm font-semibold border-b border-border pb-2 ${
                  date === today ? 'text-accent' : 'text-foreground'
                }`}
              >
                {date === today ? 'Today, ' : ''}
                {formatUkDate(date)}
              </h2>
              {items.map((event) => (
                <div
                  key={event.id}
                  className="border border-border rounded-card p-3 flex items-center justify-between gap-3"
                >
                  <div>
                    <h3 className="font-semibold text-base">{event.title}</h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {event.all_day
                        ? 'All day'
                        : `${timeLabel(event.start_time)}${
                            event.end_time ? ` - ${timeLabel(event.end_time)}` : ''
                          }`}
                      {event.assigned_to
                        ? ` • ${
                            members.find((member) => member.id === event.assigned_to)
                              ?.name ?? 'Assigned'
                          }`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditDialog(event)}
                      className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => deleteEvent(event.id)}
                      className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </section>
          ))}
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit calendar event' : 'Add calendar event'}
      >
        <form onSubmit={handleSave} className="space-y-4">
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ev_start" className="block text-sm font-medium mb-1">
                Starts
              </label>
              <Input
                id="ev_start"
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="ev_end" className="block text-sm font-medium mb-1">
                Ends (optional)
              </label>
              <Input
                id="ev_end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="ev_all_day"
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <label htmlFor="ev_all_day" className="text-sm font-medium">
              All day
            </label>
          </div>

          <div>
            <label htmlFor="ev_assigned" className="block text-sm font-medium mb-1">
              Assigned to (optional)
            </label>
            <select
              id="ev_assigned"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="">Everyone</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="ev_reminder" className="block text-sm font-medium mb-1">
              Reminder minutes before (optional)
            </label>
            <Input
              id="ev_reminder"
              type="number"
              min="0"
              value={reminderMinutes}
              onChange={(e) => setReminderMinutes(e.target.value)}
              placeholder="Household default"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Save event'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
