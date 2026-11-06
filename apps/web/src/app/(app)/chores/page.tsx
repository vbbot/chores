'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { weekdayIndex } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dueLabel, formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import {
  AssignmentMode,
  ChoreInstance,
  ChoreSuggestion,
  ChoreTaskType,
  ChoreTemplate,
  Room,
  User,
} from '@/lib/types';

const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Fortnightly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
};

const MODE_LABELS: Record<AssignmentMode, string> = {
  balanced: 'Auto-balanced',
  anyone: 'Anyone',
  fixed: 'One person',
  rotate: 'Takes turns',
};

const MODE_HELP: Record<AssignmentMode, string> = {
  balanced: 'The next occurrence goes to whoever has the lightest load this week.',
  anyone: 'No owner. Anyone can claim the chore.',
  fixed: 'The same person gets every occurrence.',
  rotate: 'Members take turns in the order you choose.',
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const NTH_LABELS = ['First', 'Second', 'Third', 'Fourth', 'Last'];

function dayOfMonth(value: string): number {
  return Number(value.slice(8, 10));
}

function scheduleSummary(template: ChoreTemplate): string {
  const parts = [frequencyLabel(template)];
  if (
    (template.frequency === 'weekly' || template.frequency === 'biweekly') &&
    template.weekdays &&
    template.weekdays.length > 0
  ) {
    parts.push(
      template.weekdays
        .slice()
        .sort((a, b) => a - b)
        .map((day) => WEEKDAY_LABELS[day])
        .join(', ')
    );
  }
  if (
    template.frequency === 'monthly' ||
    template.frequency === 'quarterly' ||
    template.frequency === 'yearly'
  ) {
    if (
      template.monthly_mode === 'nth_weekday' &&
      template.monthly_nth !== null &&
      template.monthly_nth !== undefined &&
      template.monthly_weekday !== null &&
      template.monthly_weekday !== undefined
    ) {
      const nth =
        template.monthly_nth === -1 ? 'Last' : NTH_LABELS[template.monthly_nth - 1];
      parts.push(`${nth} ${WEEKDAY_LABELS[template.monthly_weekday]}`);
    } else if (template.monthly_day) {
      parts.push(`Day ${template.monthly_day}`);
    }
  }
  if (template.due_time) parts.push(`at ${template.due_time}`);
  if (template.end_date) parts.push(`until ${formatUkDate(template.end_date)}`);
  return parts.join(' • ');
}

function reminderLabel(template: ChoreTemplate): string {
  if (!template.reminder_mode || template.reminder_mode === 'none') return '';
  if (template.reminder_mode === 'at_time') {
    return `Reminder at ${template.reminder_time ?? template.due_time ?? '09:00'}`;
  }
  return `Reminder ${template.reminder_offset_minutes ?? 0} minutes before`;
}

function frequencyName(frequency: string): string {
  return FREQUENCY_LABELS[frequency] ?? frequency;
}

function frequencyLabel(template: ChoreTemplate): string {
  if (template.frequency === 'every_n_days') {
    return `Every ${template.frequency_days ?? 3} days`;
  }
  return frequencyName(template.frequency);
}

function ownerLabel(
  instance: ChoreInstance,
  members: User[],
  currentUserId?: string
): string {
  if (!instance.assigned_to) return 'Anyone';
  if (instance.assigned_to === currentUserId) return 'You';
  return members.find((member) => member.id === instance.assigned_to)?.name ?? 'Unknown';
}

function templateModeLabel(template: ChoreTemplate, members: User[]): string {
  const mode = template.assignment_mode ?? 'balanced';
  if (mode === 'fixed') {
    const name = members.find((member) => member.id === template.fixed_assignee_id)?.name;
    return name ? `Always ${name}` : 'One person';
  }
  return MODE_LABELS[mode];
}

export default function ChoresPage() {
  const today = londonDateString();
  const queryClient = useQueryClient();
  const { user } = useAuth();

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
    queryKeys.chores.pending,
    '/api/v1/chores/instances?status=pending'
  );
  const historyQuery = useApiQuery<ChoreInstance[]>(
    queryKeys.chores.history,
    '/api/v1/chores/instances?closed=true'
  );
  const suggestionsQuery = useApiQuery<ChoreSuggestion[]>(
    queryKeys.suggestions,
    '/api/v1/suggestions'
  );

  const templates = templatesQuery.data ?? [];
  const instances = instancesQuery.data ?? [];
  const history = historyQuery.data ?? [];
  const rooms = householdQuery.data?.rooms ?? [];
  const members = membersQuery.data ?? [];
  const suggestions = suggestionsQuery.data ?? [];

  const dueInstances = React.useMemo(
    () => instances.filter((instance) => instance.due_date <= today),
    [instances, today]
  );
  const upcomingOneOff = React.useMemo(
    () =>
      instances.filter(
        (instance) => instance.task_type === 'one_off' && instance.due_date > today
      ),
    [instances, today]
  );
  const recurringTemplates = templates.filter(
    (template) => template.task_type !== 'one_off'
  );
  const recentHistory = React.useMemo(
    () =>
      [...history]
        .sort((a, b) => {
          const aKey = a.completed_at ?? a.due_date;
          const bKey = b.completed_at ?? b.due_date;
          return bKey.localeCompare(aKey);
        })
        .slice(0, 10),
    [history]
  );

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [scope, setScope] = React.useState<'all' | 'mine' | 'open'>('all');

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [taskType, setTaskType] = React.useState<ChoreTaskType>('recurring');

  const [name, setName] = React.useState('');
  const [roomId, setRoomId] = React.useState('');
  const [dueDate, setDueDate] = React.useState(today);
  const [startDate, setStartDate] = React.useState(today);
  const [dueTime, setDueTime] = React.useState('');
  const [frequency, setFrequency] = React.useState('weekly');
  const [weekdays, setWeekdays] = React.useState<number[]>([weekdayIndex(today)]);
  const [monthlyMode, setMonthlyMode] = React.useState<'day_of_month' | 'nth_weekday'>(
    'day_of_month'
  );
  const [monthlyDay, setMonthlyDay] = React.useState(dayOfMonth(today));
  const [monthlyNth, setMonthlyNth] = React.useState(1);
  const [monthlyWeekday, setMonthlyWeekday] = React.useState(weekdayIndex(today));
  const [endDate, setEndDate] = React.useState('');
  const [reminderMode, setReminderMode] = React.useState<
    'none' | 'at_time' | 'before_due'
  >('none');
  const [reminderTime, setReminderTime] = React.useState('09:00');
  const [reminderOffset, setReminderOffset] = React.useState(60);
  const [estimatedMinutes, setEstimatedMinutes] = React.useState(15);
  const [priority, setPriority] = React.useState<'low' | 'medium' | 'high'>('medium');
  const [assignmentMode, setAssignmentMode] = React.useState<AssignmentMode>('balanced');
  const [fixedAssigneeId, setFixedAssigneeId] = React.useState('');
  const [rotationMemberIds, setRotationMemberIds] = React.useState<string[]>([]);
  const [isActive, setIsActive] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);

  const [assigningInstance, setAssigningInstance] = React.useState<ChoreInstance | null>(
    null
  );
  const [assignError, setAssignError] = React.useState<string | null>(null);

  const refreshChores = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.chores.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.suggestions }),
      queryClient.invalidateQueries({ queryKey: queryKeys.progress }),
    ]);
  };

  const resetForm = (nextTaskType: ChoreTaskType) => {
    setEditingId(null);
    setTaskType(nextTaskType);
    setFormError(null);
    setName('');
    setRoomId('');
    setDueDate(today);
    setStartDate(today);
    setDueTime('');
    setFrequency('weekly');
    setWeekdays([weekdayIndex(today)]);
    setMonthlyMode('day_of_month');
    setMonthlyDay(dayOfMonth(today));
    setMonthlyNth(1);
    setMonthlyWeekday(weekdayIndex(today));
    setEndDate('');
    setReminderMode('none');
    setReminderTime('09:00');
    setReminderOffset(60);
    setEstimatedMinutes(15);
    setPriority('medium');
    setAssignmentMode(members.length > 0 ? 'balanced' : 'anyone');
    setFixedAssigneeId(members[0]?.id ?? '');
    setRotationMemberIds(members.map((member) => member.id));
    setIsActive(true);
  };

  const openCreateDialog = (nextTaskType: ChoreTaskType = 'recurring') => {
    resetForm(nextTaskType);
    setDialogOpen(true);
  };

  const openSuggestion = (suggestion: ChoreSuggestion) => {
    resetForm('recurring');
    setName(suggestion.name);
    setRoomId(suggestion.room_id ?? '');
    setFrequency(suggestion.frequency);
    setEstimatedMinutes(suggestion.estimated_minutes);
    setPriority(suggestion.priority);
    setDialogOpen(true);
  };

  const openEditDialog = (template: ChoreTemplate) => {
    const nextTaskType: ChoreTaskType = template.task_type ?? 'recurring';
    setEditingId(template.id);
    setTaskType(nextTaskType);
    setName(template.name);
    setRoomId(template.room_id ?? '');
    const due = template.next_due_date ?? today;
    setDueDate(due);
    setStartDate(template.start_date ?? due);
    setDueTime(template.due_time ?? '');
    setFrequency(template.frequency);
    setWeekdays(
      template.weekdays && template.weekdays.length > 0
        ? template.weekdays
        : [weekdayIndex(due)]
    );
    setMonthlyMode(template.monthly_mode ?? 'day_of_month');
    setMonthlyDay(template.monthly_day ?? dayOfMonth(due));
    setMonthlyNth(template.monthly_nth ?? 1);
    setMonthlyWeekday(template.monthly_weekday ?? weekdayIndex(due));
    setEndDate(template.end_date ?? '');
    setReminderMode(template.reminder_mode ?? 'none');
    setReminderTime(template.reminder_time ?? template.due_time ?? '09:00');
    setReminderOffset(template.reminder_offset_minutes ?? 60);
    setEstimatedMinutes(template.estimated_minutes ?? 15);
    setPriority(template.priority);
    setAssignmentMode(template.assignment_mode ?? 'balanced');
    setFixedAssigneeId(template.fixed_assignee_id ?? members[0]?.id ?? '');
    setRotationMemberIds(
      template.rotation_member_ids && template.rotation_member_ids.length > 0
        ? template.rotation_member_ids
        : members.map((member) => member.id)
    );
    setIsActive(template.is_active);
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      setFormError('Give the chore a name.');
      return;
    }

    if (
      taskType === 'recurring' &&
      (frequency === 'weekly' || frequency === 'biweekly') &&
      weekdays.length === 0
    ) {
      setFormError('Choose at least one weekday.');
      return;
    }

    setSubmitting(true);
    setFormError(null);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        room_id: roomId || null,
        estimated_minutes: estimatedMinutes,
        priority,
        due_time: dueTime || null,
        reminder_mode: reminderMode,
        reminder_time: reminderMode === 'at_time' ? reminderTime : null,
        reminder_offset_minutes:
          reminderMode === 'before_due' ? reminderOffset : null,
        assignment_mode: assignmentMode,
        fixed_assignee_id: assignmentMode === 'fixed' ? fixedAssigneeId || null : null,
        rotation_member_ids:
          assignmentMode === 'rotate' ? rotationMemberIds : null,
      };

      if (taskType === 'one_off') {
        body.task_type = 'one_off';
        body.due_date = dueDate;
      } else {
        body.task_type = 'recurring';
        body.start_date = startDate;
        body.frequency = frequency;
        body.weekdays =
          frequency === 'weekly' || frequency === 'biweekly' ? weekdays : null;
        if (
          frequency === 'monthly' ||
          frequency === 'quarterly' ||
          frequency === 'yearly'
        ) {
          body.monthly_mode = monthlyMode;
          if (monthlyMode === 'day_of_month') {
            body.monthly_day = monthlyDay;
            body.monthly_nth = null;
            body.monthly_weekday = null;
          } else {
            body.monthly_nth = monthlyNth;
            body.monthly_weekday = monthlyWeekday;
            body.monthly_day = null;
          }
        } else {
          body.monthly_mode = null;
          body.monthly_day = null;
          body.monthly_nth = null;
          body.monthly_weekday = null;
        }
        body.end_date = endDate || null;
        body.is_active = isActive;
      }

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
      setStatusMessage('Chore skipped.');
      await refreshChores();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not skip this chore.');
    } finally {
      setBusyId(null);
    }
  };

  const undoChore = async (id: string) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/chores/instances/${id}/undo`, { method: 'POST' });
      setStatusMessage('Chore restored.');
      await refreshChores();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not undo this chore.');
    } finally {
      setBusyId(null);
    }
  };

  const assignChore = async (id: string, assignedTo: string | null) => {
    setBusyId(id);
    setActionError(null);
    try {
      await apiFetch(`/api/v1/chores/instances/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ assigned_to: assignedTo }),
      });
      setAssigningInstance(null);
      setAssignError(null);
      await refreshChores();
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : 'Could not reassign this chore.');
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
    const noun = taskType === 'one_off' ? 'one-off task' : 'recurring chore';
    if (
      !window.confirm(
        `Delete this ${noun}? Pending work will be removed. Completed history stays.`
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

  const toggleRotationMember = (memberId: string) => {
    setRotationMemberIds((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : [...previous, memberId]
    );
  };

  const filteredDue = dueInstances.filter((instance) => {
    if (scope === 'mine') return instance.assigned_to === user?.id;
    if (scope === 'open') return instance.assigned_to === null;
    return true;
  });

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Chores</h1>
          <p className="text-sm text-secondary">
            Due work, one-off tasks, and the recurring schedule.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCreateDialog('one_off')} variant="secondary">
            Add task
          </Button>
          <Button onClick={() => openCreateDialog('recurring')}>Add chore</Button>
        </div>
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
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Due now</h2>
          <span className="text-xs text-secondary">{dueInstances.length} pending</span>
        </div>

        {members.length > 1 && (
          <div className="flex w-fit border border-border rounded-card p-1">
            {[
              { key: 'all' as const, label: 'All' },
              { key: 'mine' as const, label: 'Mine' },
              { key: 'open' as const, label: 'Up for grabs' },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setScope(item.key)}
                aria-pressed={scope === item.key}
                className={`min-h-[44px] px-3 text-xs rounded-card transition-colors ${
                  scope === item.key
                    ? 'bg-surface text-foreground font-semibold'
                    : 'text-secondary hover:text-foreground'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        {filteredDue.length === 0 ? (
          <EmptyState
            title={scope === 'mine' ? 'Nothing assigned to you' : 'Nothing due'}
            description={
              scope === 'mine'
                ? 'You have no chores due today or overdue.'
                : 'No chores are due today or overdue.'
            }
            actionLabel="Add a one-off task"
            onAction={() => openCreateDialog('one_off')}
          />
        ) : (
          <div className="space-y-2">
            {filteredDue.map((instance) => {
              const overdue = instance.due_date < today;
              const busy = busyId === instance.id;
              const oneOff = instance.task_type === 'one_off';
              return (
                <div
                  key={instance.id}
                  className={`rounded-card border p-3 space-y-3 ${
                    overdue ? 'border-destructive' : 'border-border'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h3 className="font-semibold text-base">{instance.template_name || 'Task'}</h3>
                      <p
                        className={`text-xs mt-0.5 ${
                          overdue ? 'text-destructive font-medium' : 'text-secondary'
                        }`}
                      >
                        {dueLabel(instance.due_date, today)}
                        {instance.due_time ? ` at ${instance.due_time}` : ''}
                        {instance.room_name ? ` • ${instance.room_name}` : ''}
                        {oneOff ? ' • One-off' : ''}
                      </p>
                      <p className="text-xs text-secondary mt-1">
                        Assigned to{' '}
                        <span className="text-foreground font-medium">
                          {ownerLabel(instance, members, user?.id)}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
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
                      <button
                        type="button"
                        onClick={() => {
                          setAssigningInstance(instance);
                          setAssignError(null);
                        }}
                        disabled={busy}
                        className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1 disabled:opacity-50"
                      >
                        Assign
                      </button>
                      {oneOff && (
                        <button
                          type="button"
                          onClick={() => {
                            const template = templates.find(
                              (item) => item.id === instance.template_id
                            );
                            if (template) openEditDialog(template);
                          }}
                          className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
                        >
                          Edit
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {upcomingOneOff.length > 0 && (
        <section className="space-y-3">
          <div className="border-b border-border pb-2">
            <h2 className="text-lg font-semibold">One-off tasks</h2>
            <p className="text-xs text-secondary">Scheduled for a future date.</p>
          </div>
          <div className="space-y-2">
            {upcomingOneOff.map((instance) => (
              <div
                key={instance.id}
                className="border border-border rounded-card p-3 flex flex-wrap items-start justify-between gap-3"
              >
                <div>
                  <h3 className="font-semibold text-base">{instance.template_name || 'Task'}</h3>
                  <p className="text-xs text-secondary mt-0.5">
                    {formatUkDate(instance.due_date)}
                    {instance.due_time ? ` at ${instance.due_time}` : ''}
                    {instance.room_name ? ` • ${instance.room_name}` : ''}
                  </p>
                  <p className="text-xs text-secondary mt-1">
                    Assigned to{' '}
                    <span className="text-foreground font-medium">
                      {ownerLabel(instance, members, user?.id)}
                    </span>
                  </p>
                </div>
                <Button
                  onClick={() => {
                    const template = templates.find(
                      (item) => item.id === instance.template_id
                    );
                    if (template) openEditDialog(template);
                  }}
                  variant="secondary"
                  className="text-xs px-3 py-1"
                >
                  Edit
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

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
                    onClick={() => openSuggestion(suggestion)}
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
        {recurringTemplates.length === 0 ? (
          <EmptyState
            title="No recurring chores yet"
            description="Create a recurring chore and it will create due work on its own schedule."
            actionLabel="Add your first chore"
            onAction={() => openCreateDialog('recurring')}
          />
        ) : (
          <div className="space-y-2">
            {recurringTemplates.map((template) => {
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
                      {scheduleSummary(template)}
                      {template.estimated_minutes
                        ? ` • ~${template.estimated_minutes} mins`
                        : ''}
                    </p>
                    <p className="text-xs text-secondary mt-1">
                      {templateModeLabel(template, members)} •{' '}
                      {template.next_due_date
                        ? `Next due ${formatUkDate(template.next_due_date)}`
                        : 'Next due not scheduled'}
                      {template.streak_current
                        ? ` • ${template.streak_current} on time in a row`
                        : ''}
                    </p>
                    {reminderLabel(template) && (
                      <p className="text-xs text-secondary mt-0.5">
                        {reminderLabel(template)}
                      </p>
                    )}
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

      <section className="space-y-3">
        <div className="border-b border-border pb-2">
          <h2 className="text-lg font-semibold">Recent history</h2>
          <p className="text-xs text-secondary">
            Undo restores the latest occurrence and removes the next one.
          </p>
        </div>
        {recentHistory.length === 0 ? (
          <p className="text-sm text-secondary">No closed chores yet.</p>
        ) : (
          <div className="space-y-2">
            {recentHistory.map((instance) => {
              const completedBy = instance.completed_by
                ? instance.completed_by === user?.id
                  ? 'You'
                  : members.find((member) => member.id === instance.completed_by)?.name ??
                    'Someone'
                : null;
              const templateExists = templates.some(
                (template) => template.id === instance.template_id
              );
              return (
                <div
                  key={instance.id}
                  className="border border-border rounded-card p-3 flex flex-wrap items-start justify-between gap-3"
                >
                  <div>
                    <h3 className="font-semibold text-sm">
                      {instance.template_name || 'Task'}
                    </h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {formatUkDate(instance.due_date)}
                      {instance.due_time ? ` at ${instance.due_time}` : ''} •{' '}
                      {instance.status === 'completed' ? 'Completed' : 'Skipped'}
                      {completedBy ? ` by ${completedBy}` : ''}
                      {typeof instance.xp_awarded === 'number'
                        ? ` • +${instance.xp_awarded} XP`
                        : ''}
                    </p>
                  </div>
                  {templateExists ? (
                    <button
                      type="button"
                      onClick={() => undoChore(instance.id)}
                      disabled={busyId === instance.id}
                      className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1 disabled:opacity-50"
                    >
                      Undo
                    </button>
                  ) : (
                    <span className="text-xs text-secondary">Archived</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={
          editingId
            ? taskType === 'one_off'
              ? 'Edit one-off task'
              : 'Edit recurring chore'
            : taskType === 'one_off'
              ? 'Add one-off task'
              : 'Add recurring chore'
        }
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
              {taskType === 'one_off' ? 'Task name' : 'Chore name'}
            </label>
            <Input
              id="chore_name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={taskType === 'one_off' ? 'Call the plumber' : 'Deep clean the oven'}
            />
          </div>

          <div>
            <label htmlFor="chore_room" className="block text-sm font-medium mb-1">
              Room or area
            </label>
            <select
              id="chore_room"
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
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

          {taskType === 'one_off' ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="chore_due" className="block text-sm font-medium mb-1">
                  Due date
                </label>
                <Input
                  id="chore_due"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="chore_time" className="block text-sm font-medium mb-1">
                  Due time (optional)
                </label>
                <Input
                  id="chore_time"
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="chore_start" className="block text-sm font-medium mb-1">
                  Starts
                </label>
                <Input
                  id="chore_start"
                  type="date"
                  required
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="chore_time" className="block text-sm font-medium mb-1">
                  Due time (optional)
                </label>
                <Input
                  id="chore_time"
                  type="time"
                  value={dueTime}
                  onChange={(event) => setDueTime(event.target.value)}
                />
              </div>
            </div>
          )}

          {taskType === 'recurring' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="chore_freq" className="block text-sm font-medium mb-1">
                    Frequency
                  </label>
                  <select
                    id="chore_freq"
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
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
                    onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
                  />
                </div>
              </div>

              {(frequency === 'weekly' || frequency === 'biweekly') && (
                <fieldset>
                  <legend className="block text-sm font-medium mb-2">Weekdays</legend>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAY_LABELS.map((label, index) => (
                      <label
                        key={label}
                        className={`min-h-[44px] px-3 inline-flex items-center gap-2 rounded-card border text-sm ${
                          weekdays.includes(index)
                            ? 'border-accent text-accent bg-surface font-semibold'
                            : 'border-border'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={weekdays.includes(index)}
                          onChange={() =>
                            setWeekdays((previous) =>
                              previous.includes(index)
                                ? previous.filter((day) => day !== index)
                                : [...previous, index]
                            )
                          }
                          className="w-4 h-4 rounded"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {(frequency === 'monthly' ||
                frequency === 'quarterly' ||
                frequency === 'yearly') && (
                <div className="space-y-3">
                  <div>
                    <label htmlFor="monthly_mode" className="block text-sm font-medium mb-1">
                      Monthly pattern
                    </label>
                    <select
                      id="monthly_mode"
                      value={monthlyMode}
                      onChange={(event) =>
                        setMonthlyMode(
                          event.target.value as 'day_of_month' | 'nth_weekday'
                        )
                      }
                      className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                    >
                      <option value="day_of_month">Day of the month</option>
                      <option value="nth_weekday">Nth weekday</option>
                    </select>
                  </div>
                  {monthlyMode === 'day_of_month' ? (
                    <div>
                      <label htmlFor="monthly_day" className="block text-sm font-medium mb-1">
                        Day
                      </label>
                      <Input
                        id="monthly_day"
                        type="number"
                        min="1"
                        max="31"
                        value={monthlyDay}
                        onChange={(event) =>
                          setMonthlyDay(Number(event.target.value))
                        }
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="monthly_nth" className="block text-sm font-medium mb-1">
                          Which
                        </label>
                        <select
                          id="monthly_nth"
                          value={monthlyNth}
                          onChange={(event) =>
                            setMonthlyNth(Number(event.target.value))
                          }
                          className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                        >
                          {[1, 2, 3, 4, -1].map((nth) => (
                            <option key={nth} value={nth}>
                              {nth === -1 ? 'Last' : NTH_LABELS[nth - 1]}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="monthly_weekday"
                          className="block text-sm font-medium mb-1"
                        >
                          Weekday
                        </label>
                        <select
                          id="monthly_weekday"
                          value={monthlyWeekday}
                          onChange={(event) =>
                            setMonthlyWeekday(Number(event.target.value))
                          }
                          className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                        >
                          {WEEKDAY_LABELS.map((label, index) => (
                            <option key={label} value={index}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label htmlFor="chore_end" className="block text-sm font-medium mb-1">
                  Ends (optional)
                </label>
                <Input
                  id="chore_end"
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                />
              </div>
            </>
          )}

          {taskType === 'one_off' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task_mins" className="block text-sm font-medium mb-1">
                  Estimated mins
                </label>
                <Input
                  id="task_mins"
                  type="number"
                  min="1"
                  value={estimatedMinutes}
                  onChange={(event) => setEstimatedMinutes(Number(event.target.value))}
                />
              </div>
              <div>
                <label htmlFor="task_priority" className="block text-sm font-medium mb-1">
                  Priority
                </label>
                <select
                  id="task_priority"
                  value={priority}
                  onChange={(event) =>
                    setPriority(event.target.value as 'low' | 'medium' | 'high')
                  }
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
          )}

          {taskType === 'recurring' && (
            <div>
              <label htmlFor="chore_priority" className="block text-sm font-medium mb-1">
                Priority
              </label>
              <select
                id="chore_priority"
                value={priority}
                onChange={(event) =>
                  setPriority(event.target.value as 'low' | 'medium' | 'high')
                }
                className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label htmlFor="reminder_mode" className="block text-sm font-medium mb-1">
                Reminder
              </label>
              <select
                id="reminder_mode"
                value={reminderMode}
                onChange={(event) =>
                  setReminderMode(
                    event.target.value as 'none' | 'at_time' | 'before_due'
                  )
                }
                className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
              >
                <option value="none">No extra reminder</option>
                <option value="at_time">At a set time</option>
                <option value="before_due">Before the due time</option>
              </select>
            </div>
            {reminderMode === 'at_time' && (
              <div>
                <label htmlFor="reminder_time" className="block text-sm font-medium mb-1">
                  Remind at
                </label>
                <Input
                  id="reminder_time"
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                />
              </div>
            )}
            {reminderMode === 'before_due' && (
              <div>
                <label htmlFor="reminder_offset" className="block text-sm font-medium mb-1">
                  Minutes before
                </label>
                <Input
                  id="reminder_offset"
                  type="number"
                  min="0"
                  value={reminderOffset}
                  onChange={(event) => setReminderOffset(Number(event.target.value))}
                />
              </div>
            )}
            <p className="text-xs text-secondary">
              Unassigned chores appear in the daily brief, not in per-chore reminders.
            </p>
          </div>

          <div>
            <label htmlFor="assignment_mode" className="block text-sm font-medium mb-1">
              Who does this?
            </label>
            <select
              id="assignment_mode"
              value={assignmentMode}
              onChange={(event) =>
                setAssignmentMode(event.target.value as AssignmentMode)
              }
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="balanced">Balance automatically</option>
              <option value="anyone">Anyone</option>
              <option value="fixed">One person</option>
              <option value="rotate">Take turns</option>
            </select>
            <p className="text-xs text-secondary mt-1">{MODE_HELP[assignmentMode]}</p>
          </div>

          {assignmentMode === 'fixed' && (
            <div>
              <label htmlFor="fixed_assignee" className="block text-sm font-medium mb-1">
                Person
              </label>
              <select
                id="fixed_assignee"
                value={fixedAssigneeId}
                onChange={(event) => setFixedAssigneeId(event.target.value)}
                className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
              >
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {assignmentMode === 'rotate' && (
            <fieldset>
              <legend className="block text-sm font-medium mb-2">
                Members in the rotation
              </legend>
              <div className="space-y-2">
                {members.map((member) => (
                  <label
                    key={member.id}
                    className="flex items-center gap-2 min-h-[44px] text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={rotationMemberIds.includes(member.id)}
                      onChange={() => toggleRotationMember(member.id)}
                      className="w-4 h-4 rounded"
                    />
                    {member.name}
                  </label>
                ))}
              </div>
              <p className="text-xs text-secondary">
                Leave all unchecked to include everyone.
              </p>
            </fieldset>
          )}

          {editingId && taskType === 'recurring' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="chore_active"
                checked={isActive}
                onChange={(event) => setIsActive(event.target.checked)}
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
                {submitting ? 'Saving...' : taskType === 'one_off' ? 'Save task' : 'Save chore'}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={assigningInstance !== null}
        onClose={() => {
          setAssigningInstance(null);
          setAssignError(null);
        }}
        title="Assign this chore"
      >
        <div className="space-y-2">
          {assignError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {assignError}
            </div>
          )}
          <button
            type="button"
            onClick={() =>
              assigningInstance && assignChore(assigningInstance.id, null)
            }
            className={`w-full min-h-[44px] px-3 text-left text-sm rounded-card border transition-colors ${
              assigningInstance?.assigned_to === null
                ? 'border-accent text-accent bg-surface font-semibold'
                : 'border-border hover:bg-surface'
            }`}
          >
            Anyone
          </button>
          {members.map((member) => (
            <button
              key={member.id}
              type="button"
              onClick={() =>
                assigningInstance && assignChore(assigningInstance.id, member.id)
              }
              className={`w-full min-h-[44px] px-3 text-left text-sm rounded-card border transition-colors ${
                assigningInstance?.assigned_to === member.id
                  ? 'border-accent text-accent bg-surface font-semibold'
                  : 'border-border hover:bg-surface'
              }`}
            >
              {member.name}
              {member.id === user?.id ? ' (you)' : ''}
            </button>
          ))}
        </div>
      </Dialog>
    </div>
  );
}
