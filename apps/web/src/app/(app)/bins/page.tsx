'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { formatUkDate, londonDateString } from '@/lib/dates';
import { BinException, BinSchedule } from '@/lib/types';
import { formatDayName } from '@/lib/utils';

export default function BinsPage() {
  const queryClient = useQueryClient();
  const {
    data: scheduleData,
    isLoading: schedulesLoading,
    error: schedulesError,
  } = useApiQuery<BinSchedule[]>(queryKeys.bins.schedules, '/api/v1/bins/schedules');
  const { data: exceptionData, error: exceptionsError } = useApiQuery<BinException[]>(
    queryKeys.bins.exceptions,
    '/api/v1/bins/exceptions'
  );
  const schedules = scheduleData ?? [];
  const exceptions = exceptionData ?? [];
  const loading = schedulesLoading && !scheduleData;
  const error = schedulesError ?? exceptionsError;
  const [formError, setFormError] = React.useState<string | null>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [exceptionSchedule, setExceptionSchedule] = React.useState<BinSchedule | null>(null);
  const [exceptionDialogOpen, setExceptionDialogOpen] = React.useState(false);

  // Form state
  const [name, setName] = React.useState('');
  const [colour, setColour] = React.useState('black');
  const [collectionDay, setCollectionDay] = React.useState(0);
  const [frequency, setFrequency] = React.useState('weekly');
  const [submitting, setSubmitting] = React.useState(false);

  // Exception form state
  const [originalDate, setOriginalDate] = React.useState('');
  const [exceptionAction, setExceptionAction] = React.useState<'skip' | 'move'>('skip');
  const [movedToDate, setMovedToDate] = React.useState('');
  const [exceptionReason, setExceptionReason] = React.useState('');
  const [exceptionError, setExceptionError] = React.useState<string | null>(null);
  const [exceptionSubmitting, setExceptionSubmitting] = React.useState(false);

  const openCreateDialog = () => {
    setFormError(null);
    setDialogOpen(true);
  };

  const deleteSchedule = async (schedule: BinSchedule) => {
    if (
      !window.confirm(
        `Delete the ${schedule.name} collection? Its scheduled changes will be removed too.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await apiFetch(`/api/v1/bins/schedules/${schedule.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bins.all });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Could not delete this bin collection.'
      );
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const today = londonDateString();
      await apiFetch<BinSchedule>('/api/v1/bins/schedules', {
        method: 'POST',
        body: JSON.stringify({
          bin_type: 'other',
          name: name.trim(),
          colour,
          collection_day: collectionDay,
          frequency,
          start_date: today,
        }),
      });
      setDialogOpen(false);
      setName('');
      await queryClient.invalidateQueries({ queryKey: queryKeys.bins.all });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save schedule');
    } finally {
      setSubmitting(false);
    }
  };

  const openExceptionDialog = (schedule: BinSchedule) => {
    setExceptionSchedule(schedule);
    setOriginalDate(schedule.next_collection || '');
    setExceptionAction('skip');
    setMovedToDate('');
    setExceptionReason('');
    setExceptionError(null);
    setExceptionDialogOpen(true);
  };

  const saveException = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!exceptionSchedule || !originalDate) {
      setExceptionError('Choose the collection date to change.');
      return;
    }
    if (exceptionAction === 'move' && !movedToDate) {
      setExceptionError('Choose the new collection date.');
      return;
    }

    setExceptionSubmitting(true);
    setExceptionError(null);
    try {
      await apiFetch<BinException>('/api/v1/bins/exceptions', {
        method: 'POST',
        body: JSON.stringify({
          schedule_id: exceptionSchedule.id,
          original_date: originalDate,
          action: exceptionAction,
          moved_to_date: exceptionAction === 'move' ? movedToDate : null,
          reason: exceptionReason.trim() || null,
        }),
      });
      setExceptionDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.bins.all });
    } catch (err) {
      setExceptionError(err instanceof Error ? err.message : 'Could not save this change.');
    } finally {
      setExceptionSubmitting(false);
    }
  };

  const removeException = async (exception: BinException) => {
    setActionError(null);
    try {
      await apiFetch(`/api/v1/bins/exceptions/${exception.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bins.all });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not undo this change.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Bin collections</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading bin collection dates...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Bin collections</h1>
          <p className="text-sm text-secondary">
            Weekly and fortnightly council collection schedules. Put bins out the evening before.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add bin</Button>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load bin schedules.')}
        </div>
      )}

      {schedules.length === 0 ? (
        <EmptyState
          title="No bins configured"
          description="Add your council bin types (General waste, Recycling, Garden waste) to receive reminders."
          actionLabel="Configure your bins"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <span
                      className="w-4 h-4 rounded-full border border-foreground flex-shrink-0"
                      style={{ backgroundColor: s.colour.toLowerCase() }}
                    />
                    <div>
                      <h3 className="font-semibold text-base">{s.name}</h3>
                      <p className="text-xs text-secondary mt-0.5">
                        {formatDayName(s.collection_day)}s • {s.frequency === 'biweekly' ? 'Fortnightly' : 'Weekly'}
                      </p>
                    </div>
                  </div>
                  {s.next_collection && (
                    <div className="text-right">
                      <span className="text-xs text-secondary block">Next collection</span>
                      <span className="text-xs font-semibold">
                        {formatUkDate(s.next_collection)}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 pt-2 border-t border-border flex items-center justify-between gap-2">
                  <button
                    onClick={() => openExceptionDialog(s)}
                    className="text-xs underline text-secondary hover:text-foreground min-h-[44px] inline-flex items-center"
                  >
                    Change next collection
                  </button>
                  <button
                    onClick={() => deleteSchedule(s)}
                    aria-label={`Delete ${s.name} collection`}
                    className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                  >
                    Delete
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {exceptions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Scheduled changes</h2>
          <div className="space-y-2">
            {exceptions.map((exception) => {
              const schedule = schedules.find((item) => item.id === exception.schedule_id);
              return (
                <div
                  key={exception.id}
                  className="p-3 border border-border rounded-card bg-background flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-medium">
                      {schedule?.name || 'Bin collection'}:{' '}
                      {formatUkDate(exception.original_date)}{' '}
                      {exception.action === 'skip'
                        ? 'skipped'
                        : `moved to ${exception.moved_to_date ? formatUkDate(exception.moved_to_date) : 'a new date'}`}
                    </div>
                    {exception.reason && (
                      <div className="text-xs text-secondary mt-0.5">{exception.reason}</div>
                    )}
                  </div>
                  <button
                    onClick={() => removeException(exception)}
                    className="text-xs text-secondary hover:text-destructive shrink-0 min-h-[44px] px-1"
                  >
                    Undo
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add bin schedule">
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
            <label htmlFor="bin_name" className="block text-sm font-medium mb-1">
              Bin name
            </label>
            <Input
              id="bin_name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Garden waste"
            />
          </div>

          <div>
            <label htmlFor="bin_colour" className="block text-sm font-medium mb-1">
              Bin colour
            </label>
            <select
              id="bin_colour"
              value={colour}
              onChange={(e) => setColour(e.target.value)}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="black">Black (General waste)</option>
              <option value="blue">Blue (Recycling paper/card)</option>
              <option value="green">Green (Mixed recycling / Garden)</option>
              <option value="brown">Brown (Food / Garden waste)</option>
              <option value="grey">Grey</option>
            </select>
          </div>

          <div>
            <label htmlFor="bin_day" className="block text-sm font-medium mb-1">
              Collection day
            </label>
            <select
              id="bin_day"
              value={collectionDay}
              onChange={(e) => setCollectionDay(Number(e.target.value))}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value={0}>Monday</option>
              <option value={1}>Tuesday</option>
              <option value={2}>Wednesday</option>
              <option value={3}>Thursday</option>
              <option value={4}>Friday</option>
              <option value={5}>Saturday</option>
              <option value={6}>Sunday</option>
            </select>
          </div>

          <div>
            <label htmlFor="bin_frequency" className="block text-sm font-medium mb-1">
              Frequency
            </label>
            <select
              id="bin_frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Fortnightly</option>
            </select>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save schedule'}
            </Button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={exceptionDialogOpen}
        onClose={() => setExceptionDialogOpen(false)}
        title={exceptionSchedule ? `Change ${exceptionSchedule.name} collection` : 'Change collection'}
      >
        <form onSubmit={saveException} className="space-y-4">
          {exceptionError && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {exceptionError}
            </div>
          )}

          <div>
            <label htmlFor="exception_original" className="block text-sm font-medium mb-1">
              Collection date to change
            </label>
            <Input
              id="exception_original"
              type="date"
              required
              value={originalDate}
              onChange={(event) => setOriginalDate(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="exception_action" className="block text-sm font-medium mb-1">
              What happened?
            </label>
            <select
              id="exception_action"
              value={exceptionAction}
              onChange={(event) =>
                setExceptionAction(event.target.value as 'skip' | 'move')
              }
              className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
            >
              <option value="skip">Collection cancelled</option>
              <option value="move">Moved to another day</option>
            </select>
          </div>

          {exceptionAction === 'move' && (
            <div>
              <label htmlFor="exception_moved" className="block text-sm font-medium mb-1">
                New collection date
              </label>
              <Input
                id="exception_moved"
                type="date"
                required
                value={movedToDate}
                onChange={(event) => setMovedToDate(event.target.value)}
              />
            </div>
          )}

          <div>
            <label htmlFor="exception_reason" className="block text-sm font-medium mb-1">
              Reason (optional)
            </label>
            <Input
              id="exception_reason"
              value={exceptionReason}
              onChange={(event) => setExceptionReason(event.target.value)}
              placeholder="e.g. Bank holiday collection"
            />
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setExceptionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={exceptionSubmitting}>
              {exceptionSubmitting ? 'Saving...' : 'Save change'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
