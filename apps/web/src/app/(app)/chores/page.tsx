'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { dueLabel, formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { ChoreInstance, ChoreSuggestion, ChoreTemplate, Room, User } from '@/lib/types';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

function frequencyName(frequency: string): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

function frequencyLabel(template: ChoreTemplate): string {
  if (template.frequency === 'every_n_days') {
    return `Every ${template.frequency_days ?? 3} days`;
  }
  return frequencyName(template.frequency);
}

export default function ChoresPage() {
  const today = londonDateString();
  const queryClient = useQueryClient();
  const templatesQuery = useApiQuery<ChoreTemplate[]>(
    queryKeys.chores.templates,
    '/api/v1/chores/templates'
  );
  const householdQuery = useApiQuery<{ rooms: Room[] }>(
    queryKeys.household,
    '/api/v1/households'
  );
  const membersQuery = useApiQuery<User[]>(queryKeys.members, '/api/v1/households/members');
  const instancesQuery = useApiQuery<ChoreInstance[]>(
    queryKeys.chores.due(today),
    `/api/v1/chores/instances?status=pending&due_before=${today}`
  );
  const suggestionsQuery = useApiQuery<ChoreSuggestion[]>(
    queryKeys.suggestions,
    '/api/v1/suggestions'
  );

  const templates = templatesQuery.data ?? [];
  const instances = instancesQuery.data ?? [];
  const rooms = householdQuery.data?.rooms ?? [];
  const members = membersQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [roomId, setRoomId] = React.useState('');
  const [frequency, setFrequency] = React.useState('weekly');
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(15);
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [isActive, setIsActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const refreshChores = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.progress }),
    ]);
  };

  const openCreateDialog = (suggestion?: ChoreSuggestion) => {
    setEditingId(null);
    setFormError(null);
    setIsActive(true);
    if (suggestion) {
      setName(suggestion.name);
      setRoomId(suggestion.room_id ?? '');
      setFrequency(suggestion.frequency);
      setEstimatedMinutes(suggestion.estimated_minutes);
      setPriority(suggestion.priority);
    } else {
      setName('');
      setRoomId('');
      setFrequency('weekly');
      setEstimatedMinutes(15);
      setPriority('medium');
    }
    setDialogOpen(true);
  };

  const openEditDialog = (template: ChoreTemplate) => {
    setEditingId(template.id);
    setName(template.name);
    setRoomId(template.room_id ?? '');
    setFrequency(template.frequency);
    setEstimatedMinutes(template.estimated_minutes ?? 15);
    setPriority(template.priority);
    setIsActive(template.is_active);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError('Give the chore a name.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const body = {
        name: name.trim(),
        room_id: roomId || null,
        frequency,
        estimated_minutes: estimatedMinutes,
        priority,
        is_active: isActive,
      };
      await apiFetch(
        editingId ? `/api/v1/chores/templates/${editingId}` : '/api/v1/chores/templates',
        {
          method: editingId ? 'PUT' : 'POST',
          body: JSON.stringify(body),
        }
      );
      await refreshChores();
      setDialogOpen(false);
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
      const result = await apiFetch<{
        xp_awarded: number;
        streak_current: number;
      }>(`/api/v1/chores/instances/${id}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      queryClient.setQueryData<ChoreInstance[]>(queryKeys.chores.due(today), (prev) =>
        prev?.filter((instance) => instance.id !== id)
      );
      setStatusMessage(
        result.streak_current > 1
          ? `Done. +${result.xp_awarded} XP. ${result.streak_current} on time in a row.`
          : `Done. +${result.xp_awarded} XP.`
      );
      await refreshChores();
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
      await apiFetch(`/api/v1/chores/instances/${id}/skip`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      queryClient.setQueryData<ChoreInstance[]>(queryKeys.chores.due(today), (prev) =>
        prev?.filter((instance) => instance.id !== id)
      );
      setStatusMessage('Chore skipped.');
      await refreshChores();
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
      await apiFetch(`/api/v1/chores/instances/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: assignedTo || null }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.chores.all });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not reassign this chore.');
    } finally {
      setBusyId(null);
    }
  };

  const dismissSuggestion = async (id: string) => {
    setActionError(null);
    try {
      await apiFetch('/api/v1/suggestions/dismiss', {
        method: 'POST',
        body: JSON.stringify({ id }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.suggestions });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not dismiss this suggestion.');
    }
  };

  const deleteTemplate = async () => {
    if (!editingId) return;
    if (
      !window.confirm(
        'Delete this recurring chore? Pending occurrences will be removed. Completed history stays.'
      )
    ) {
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(`/api/v1/chores/templates/${editingId}`, { method: 'DELETE' });
      await refreshChores();
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not delete this chore.');
    } finally {
      setSubmitting(false);
    }
  };

  const loading =
    !templatesQuery.data &&
    (templatesQuery.isLoading ||
      householdQuery.isLoading ||
      membersQuery.isLoading ||
      instancesQuery.isLoading ||
      suggestionsQuery.isLoading);
  const error =
    templatesQuery.error ??
    householdQuery.error ??
    membersQuery.error ??
    instancesQuery.error ??
    suggestionsQuery.error;

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Chores</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading household chores...
        </div>
      </div>
    );
  }

  if (error && !templatesQuery.data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Chores</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load chores.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Chores</h1>
          <p className="text-sm text-secondary">Due work, suggestions, and the recurring schedule.</p>
        </div>
        <Button onClick={() => openCreateDialog()}>Add chore</Button>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load chores.')}
        </div>
      )}
      {statusMessage && (
        <p role="status" className="p-3 text-sm rounded-card border border-border bg-surface font-medium">
          {statusMessage}
        </p>
      )}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Due now</h2>
          <span className="text-xs text-secondary">
            {instances.length} pending
          </span>
        </div>

        {instances.length === 0 ? (
          <EmptyState
            title="Nothing pending"
            description="No chores are due today or overdue."
            actionLabel="Add a chore"
            onAction={() => openCreateDialog()}
          />
        ) : (
          <div className="space-y-2">
            {instances.map((instance) => {
              const overdue = instance.due_date < today;
              const busy = busyId === instance.id;
              return (
                <div
                  key={instance.id}
                  className={`rounded-card border p-3 space-y-3 ${
                    overdue ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <div>
                    <h3 className="font-semibold text-base">{instance.template_name || 'Task'}</h3>
                    <p
                      className={`text-xs mt-0.5 ${
                        overdue ? 'text-destructive font-medium' : 'text-secondary'
                      }`}
                    >
                      {dueLabel(instance.due_date, today)}
                      {instance.room_name ? ` • ${instance.room_name}` : ''}
                    </p>
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
                        className="w-full h-11 px-2 border border-border rounded-card bg-background text-base"
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
                </div>
              );
            })}
          </div>
        )}
      </section>

      {suggestions.length > 0 && (
        <section className="space-y-3">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-semibold">Suggested for your home</h2>
            <p className="text-xs text-secondary">
              Based on your rooms, routine, and the time of year.
            </p>
          </div>
          <div className="space-y-2">
            {suggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className="p-3 border border-border rounded-card flex flex-wrap items-start justify-between gap-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <h3 className="font-medium text-sm">{suggestion.name}</h3>
                  <p className="text-xs text-secondary mt-0.5">{suggestion.reason}</p>
                  <p className="text-xs text-secondary mt-1">
                    {suggestion.room_name ? `${suggestion.room_name} • ` : ''}
                    {frequencyName(suggestion.frequency)} • ~{suggestion.estimated_minutes} mins
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => openCreateDialog(suggestion)}
                    className="text-xs px-3 py-1"
                  >
                    Add chore
                  </Button>
                  <Button
                    onClick={() => dismissSuggestion(suggestion.id)}
                    variant="secondary"
                    className="text-xs px-3 py-1"
                  >
                    Not now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Schedule</h2>
          <p className="text-xs text-secondary">The recurring rules that create due chores.</p>
        </div>
        {templates.length === 0 ? (
          <EmptyState
            title="No recurring chores yet"
            description="Create a recurring chore and it will create due work on its own schedule."
            actionLabel="Add your first chore"
            onAction={() => openCreateDialog()}
          />
        ) : (
          <div className="space-y-2">
            {templates.map((template) => {
              const roomName = rooms.find((room) => room.id === template.room_id)?.name;
              return (
                <div
                  key={template.id}
                  className="border border-border rounded-card p-3 flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <h3 className="font-semibold text-base flex items-center gap-2">
                      {template.name}
                      {!template.is_active && (
                        <span className="text-xs font-semibold text-secondary">Paused</span>
                      )}
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {roomName ? `${roomName} • ` : ''}
                      {frequencyLabel(template)}
                      {template.estimated_minutes
                        ? ` • ~${template.estimated_minutes} mins`
                        : ''}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      {template.next_due_date
                        ? `Next due ${formatUkDate(template.next_due_date)}`
                        : 'Next due not scheduled'}
                      {template.streak_current
                        ? ` • ${template.streak_current} on time in a row`
                        : ''}
                    </p>
                  </div>
                  <Button
                    onClick={() => openEditDialog(template)}
                    variant="secondary"
                    className="text-xs px-3 py-1"
                  >
                    Edit
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit recurring chore' : 'Add recurring chore'}
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
              Room or area
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
                <option value="yearly">Yearly</option>
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

          {editingId && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="chore_active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <label htmlFor="chore_active" className="text-sm font-medium">
                Recurring chore is active
              </label>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            {editingId ? (
              <Button
                type="button"
                variant="danger"
                onClick={deleteTemplate}
                disabled={submitting}
              >
                Delete
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : 'Save chore'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
