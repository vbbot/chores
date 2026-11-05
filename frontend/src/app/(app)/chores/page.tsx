'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { dueLabel, londonDateString } from '@/lib/dates';
import { ChoreInstance, ChoreTemplate, Room, User } from '@/lib/types';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

function frequencyLabel(template: ChoreTemplate): string {
  if (template.frequency === 'every_n_days') {
    return `Every ${template.frequency_days ?? 3} days`;
  }
  return FREQUENCY_LABELS[template.frequency] ?? template.frequency;
}

export default function ChoresPage() {
  const today = londonDateString();
  const [templates, setTemplates] = React.useState<ChoreTemplate[]>([]);
  const [instances, setInstances] = React.useState<ChoreInstance[]>([]);
  const [rooms, setRooms] = React.useState<Room[]>([]);
  const [members, setMembers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form state
  const [name, setName] = React.useState('');
  const [roomId, setRoomId] = React.useState('');
  const [frequency, setFrequency] = React.useState('weekly');
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(15);
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = React.useState(false);

  const loadInstances = async () => {
    const data = await apiFetch<ChoreInstance[]>(
      `/api/chores/instances?status=pending&due_before=${today}`
    );
    setInstances(data);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tpls, hh, membersData, pending] = await Promise.all([
        apiFetch<ChoreTemplate[]>('/api/chores/templates'),
        apiFetch<{ rooms: Room[] }>('/api/households'),
        apiFetch<User[]>('/api/households/members'),
        apiFetch<ChoreInstance[]>(`/api/chores/instances?status=pending&due_before=${today}`),
      ]);
      setTemplates(tpls);
      setRooms(hh.rooms || []);
      setMembers(membersData);
      setInstances(pending);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chores');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreateDialog = () => {
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Give the chore a name.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const newTemplate = await apiFetch<ChoreTemplate>('/api/chores/templates', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          room_id: roomId || null,
          frequency,
          estimated_minutes: estimatedMinutes,
          priority,
        }),
      });
      setTemplates((prev) => [...prev, newTemplate]);
      await loadInstances();
      setDialogOpen(false);
      setName('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this chore.');
    } finally {
      setSubmitting(false);
    }
  };

  const completeChore = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/chores/instances/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setInstances((prev) => prev.filter((instance) => instance.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark this chore done.');
    } finally {
      setBusyId(null);
    }
  };

  const skipChore = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/chores/instances/${id}/skip`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setInstances((prev) => prev.filter((instance) => instance.id !== id));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not skip this chore.');
    } finally {
      setBusyId(null);
    }
  };

  const assignChore = async (id: string, assignedTo: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      const updated = await apiFetch<ChoreInstance>(`/api/chores/instances/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      });
      setInstances((prev) =>
        prev.map((instance) =>
          instance.id === id ? { ...instance, assigned_to: updated.assigned_to } : instance
        )
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reassign this chore.');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Chores</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household chore templates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chores</h1>
          <p className="text-sm text-secondary">Recurring schedule with fair delegation.</p>
        </div>
        <Button onClick={openCreateDialog}>Add chore</Button>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {error}
        </div>
      )}
      {actionError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError}
        </div>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Today and overdue</h2>
          <span className="text-xs text-secondary">
            {instances.length} pending
          </span>
        </div>

        {instances.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            description="No chores are due today. Add a recurring chore and it will appear here automatically."
            actionLabel="Add a chore"
            onAction={openCreateDialog}
          />
        ) : (
          <div className="space-y-2">
            {instances.map((instance) => {
              const overdue = instance.due_date < today;
              const busy = busyId === instance.id;
              return (
                <Card
                  key={instance.id}
                  className={overdue ? 'border-heavy border-destructive' : 'border-2'}
                >
                  <CardContent className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-base">
                          {instance.template_name || 'Task'}
                        </h3>
                        <p
                          className={`text-xs mt-0.5 ${
                            overdue ? 'text-destructive font-medium' : 'text-secondary'
                          }`}
                        >
                          {dueLabel(instance.due_date, today)}
                          {instance.room_name ? ` • ${instance.room_name}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-2">
                      <div className="flex-1 min-w-[10rem] max-w-xs">
                        <label
                          htmlFor={`assign-${instance.id}`}
                          className="block text-xs text-secondary mb-1"
                        >
                          Assigned to
                        </label>
                        <select
                          id={`assign-${instance.id}`}
                          value={instance.assigned_to ?? ''}
                          disabled={busy}
                          onChange={(e) => assignChore(instance.id, e.target.value)}
                          className="w-full h-10 px-2 border border-border rounded-card bg-background text-sm"
                        >
                          <option value="">Unassigned</option>
                          {members.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <Button
                        onClick={() => completeChore(instance.id)}
                        variant="secondary"
                        className="text-xs px-3 py-1"
                        disabled={busy}
                      >
                        Mark done
                      </Button>
                      <Button
                        onClick={() => skipChore(instance.id)}
                        variant="secondary"
                        className="text-xs px-3 py-1"
                        disabled={busy}
                      >
                        Skip
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recurring templates</h2>
        {templates.length === 0 ? (
          <EmptyState
            title="No chores set up yet"
            description="Create recurring chores for your household to automatically distribute tasks."
            actionLabel="Add your first chore"
            onAction={openCreateDialog}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => {
              const roomName = rooms.find((room) => room.id === template.room_id)?.name;
              return (
                <Card key={template.id} className="border-2">
                  <CardContent>
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <h3 className="font-semibold text-base">{template.name}</h3>
                        <p className="text-xs text-secondary mt-1">
                          {roomName ? `${roomName} • ` : ''}
                          {frequencyLabel(template)}
                          {template.estimated_minutes
                            ? ` • ~${template.estimated_minutes} mins`
                            : ''}
                        </p>
                      </div>
                      <span className="text-xs border border-border px-2 py-0.5 rounded-card capitalize shrink-0">
                        {template.priority}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Add chore template"
      >
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
            <label htmlFor="chore_name" className="block text-sm font-medium mb-1">
              Chore name
            </label>
            <Input
              id="chore_name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Deep clean the oven"
            />
          </div>

          <div>
            <label htmlFor="chore_room" className="block text-sm font-medium mb-1">
              Room / Area
            </label>
            <select
              id="chore_room"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="">No specific room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="chore_freq" className="block text-sm font-medium mb-1">
                Frequency
              </label>
              <select
                id="chore_freq"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Fortnightly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </div>
            <div>
              <label htmlFor="chore_mins" className="block text-sm font-medium mb-1">
                Estimated mins
              </label>
              <Input
                id="chore_mins"
                type="number"
                min="1"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
              />
            </div>
          </div>

          <div>
            <label htmlFor="chore_priority" className="block text-sm font-medium mb-1">
              Priority
            </label>
            <select
              id="chore_priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save chore'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
