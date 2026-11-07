'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { COMMON_SYMPTOMS, HealthSeverity } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch, resolveApiUrl } from '@/lib/api';
import { formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { HealthDiary, HealthEntry } from '@/lib/types';

const LEVELS: HealthSeverity[] = [1, 2, 3, 4, 5];

const TIME_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

function currentTime(): string {
  return TIME_FORMAT.format(new Date());
}

function severityLabel(value: HealthSeverity): string {
  if (value <= 2) return 'Mild';
  if (value === 3) return 'Moderate';
  return 'Severe';
}

function energyLabel(value: HealthSeverity): string {
  if (value <= 2) return 'Low';
  if (value === 3) return 'Medium';
  return 'High';
}

function chipClass(selected: boolean): string {
  return `min-h-[44px] rounded-card border px-3 py-2 text-sm ${
    selected
      ? 'border-foreground bg-foreground text-background'
      : 'border-border bg-background text-foreground hover:bg-surface'
  }`;
}

const EXPORT_LINK_CLASS =
  'inline-flex items-center justify-center min-h-[44px] whitespace-nowrap rounded-btn border border-foreground bg-background px-4 py-2 text-sm font-semibold hover:bg-surface';

export function HealthDiaryView() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useApiQuery<HealthDiary>(
    queryKeys.health,
    '/api/v1/health'
  );

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const [date, setDate] = React.useState(londonDateString());
  const [time, setTime] = React.useState(currentTime());
  const [symptoms, setSymptoms] = React.useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = React.useState('');
  const [severity, setSeverity] = React.useState<HealthSeverity>(3);
  const [duration, setDuration] = React.useState('');
  const [energy, setEnergy] = React.useState<HealthSeverity | null>(null);
  const [notes, setNotes] = React.useState('');
  const [consent, setConsent] = React.useState(false);

  const exportHref = resolveApiUrl(
    '/api/v1/health/export',
    process.env.NEXT_PUBLIC_API_URL ?? ''
  );

  const openCreateDialog = () => {
    setEditingId(null);
    setDate(londonDateString());
    setTime(currentTime());
    setSymptoms([]);
    setCustomSymptom('');
    setSeverity(3);
    setDuration('');
    setEnergy(null);
    setNotes('');
    setConsent(false);
    setFormError(null);
    setDialogOpen(true);
  };

  const openEditDialog = (entry: HealthEntry) => {
    setEditingId(entry.id);
    setDate(entry.date);
    setTime(entry.time);
    setSymptoms(entry.symptoms);
    setCustomSymptom('');
    setSeverity(entry.severity);
    setDuration(entry.duration_minutes === null ? '' : String(entry.duration_minutes));
    setEnergy(entry.energy);
    setNotes(entry.notes ?? '');
    setConsent(false);
    setFormError(null);
    setDialogOpen(true);
  };

  const toggleSymptom = (symptom: string) => {
    setSymptoms((current) =>
      current.includes(symptom)
        ? current.filter((item) => item !== symptom)
        : [...current, symptom]
    );
  };

  const addCustomSymptom = () => {
    const value = customSymptom.trim();
    if (!value) return;
    setSymptoms((current) => (current.includes(value) ? current : [...current, value]));
    setCustomSymptom('');
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.health });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (symptoms.length === 0) {
      setFormError('Add at least one symptom.');
      return;
    }
    const needsConsent = !data?.consent_at;
    if (needsConsent && !consent) {
      setFormError('Tick the consent box to start your diary.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch(editingId ? `/api/v1/health/${editingId}` : '/api/v1/health', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          date,
          time,
          symptoms,
          severity,
          duration_minutes: duration.trim() ? Number(duration) : null,
          energy,
          notes: notes.trim() ? notes.trim() : null,
          ...(needsConsent && !editingId ? { consent: true } : {}),
        }),
      });
      await invalidate();
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not save this entry.');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteEntry = async (entry: HealthEntry) => {
    if (!(await confirm('Delete this entry? This cannot be undone.'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/health/${entry.id}`, { method: 'DELETE' });
      await invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete this entry.');
    }
  };

  const deleteAll = async () => {
    if (!(await confirm('Delete all health entries? This cannot be undone.'))) return;
    setActionError(null);
    try {
      await apiFetch('/api/v1/health', { method: 'DELETE' });
      await invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete your entries.');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="p-8 text-sm text-secondary border border-border rounded-card">
        Loading your health diary...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
        {error instanceof Error ? error.message : 'Could not load your health diary.'}
      </div>
    );
  }

  const entries = [...(data?.entries ?? [])].sort((a, b) =>
    `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`)
  );
  const hasConsent = Boolean(data?.consent_at);
  const customSymptoms = symptoms.filter((item) => !COMMON_SYMPTOMS.includes(item));

  return (
    <div className="space-y-6">
      {actionError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError}
        </div>
      )}

      {!hasConsent ? (
        <Card className="space-y-4">
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Your private health diary</h2>
            <p className="text-sm text-secondary">
              Entries are stored against your account only. They are never shown to the household,
              to admins, or in any shared view.
            </p>
            <p className="text-sm text-secondary">
              This diary is a personal record. It is not medical advice, and it does not diagnose
              anything.
            </p>
            <p className="text-sm text-secondary">
              You can export your entries as JSON or delete them at any time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openCreateDialog}>Start my diary</Button>
            <a href={exportHref} download className={EXPORT_LINK_CLASS}>
              Export
            </a>
          </div>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button onClick={openCreateDialog}>Add entry</Button>
            <a href={exportHref} download className={EXPORT_LINK_CLASS}>
              Export
            </a>
            <Button variant="secondary" onClick={deleteAll}>
              Delete all
            </Button>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              title="No entries yet"
              description="Add an entry to start your private diary."
              actionLabel="Add entry"
              onAction={openCreateDialog}
            />
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => (
                <Card key={entry.id} className="space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{formatUkDate(entry.date)}</p>
                      <p className="text-xs text-secondary">{entry.time}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => openEditDialog(entry)}
                        className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteEntry(entry)}
                        className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {entry.symptoms.map((symptom) => (
                      <span
                        key={symptom}
                        className="rounded-card border border-border px-2 py-1 text-xs text-secondary"
                      >
                        {symptom}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-secondary">
                    Severity {entry.severity} ({severityLabel(entry.severity)})
                    {entry.energy !== null ? ` · Energy ${entry.energy} (${energyLabel(entry.energy)})` : ''}
                    {entry.duration_minutes !== null
                      ? ` · Duration ${entry.duration_minutes} minutes`
                      : ''}
                  </p>

                  {entry.notes && (
                    <p className="whitespace-pre-wrap text-sm">{entry.notes}</p>
                  )}
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit health entry' : 'Add health entry'}
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="health_date" className="block text-sm font-medium mb-1">
                Date
              </label>
              <Input
                id="health_date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="health_time" className="block text-sm font-medium mb-1">
                Time
              </label>
              <Input
                id="health_time"
                type="time"
                required
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium mb-1">Symptoms</p>
            <div className="flex flex-wrap gap-2">
              {[...COMMON_SYMPTOMS, ...customSymptoms].map((symptom) => (
                <button
                  key={symptom}
                  type="button"
                  aria-pressed={symptoms.includes(symptom)}
                  onClick={() => toggleSymptom(symptom)}
                  className={chipClass(symptoms.includes(symptom))}
                >
                  {symptom}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="health_custom_symptom" className="block text-sm font-medium mb-1">
              Other symptom
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="health_custom_symptom"
                value={customSymptom}
                onChange={(e) => setCustomSymptom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomSymptom();
                  }
                }}
                placeholder="e.g. Dizziness"
              />
              <Button type="button" variant="secondary" onClick={addCustomSymptom}>
                Add
              </Button>
            </div>
          </div>

          <div>
            <p className="block text-sm font-medium mb-1">Severity</p>
            <div role="group" aria-label="Severity" className="flex flex-wrap gap-2">
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={severity === value}
                  onClick={() => setSeverity(value)}
                  className={chipClass(severity === value)}
                >
                  {value}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-secondary">1 Mild, 3 Moderate, 5 Severe</p>
          </div>

          <div>
            <p className="block text-sm font-medium mb-1">Energy</p>
            <div role="group" aria-label="Energy" className="flex flex-wrap gap-2">
              {LEVELS.map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={energy === value}
                  onClick={() => setEnergy(value)}
                  className={chipClass(energy === value)}
                >
                  {value}
                </button>
              ))}
              <button
                type="button"
                aria-pressed={energy === null}
                onClick={() => setEnergy(null)}
                className={chipClass(energy === null)}
              >
                Not set
              </button>
            </div>
            <p className="mt-1 text-xs text-secondary">1 Low to 5 High</p>
          </div>

          <div>
            <label htmlFor="health_duration" className="block text-sm font-medium mb-1">
              Duration in minutes
            </label>
            <Input
              id="health_duration"
              type="number"
              min={1}
              inputMode="numeric"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="Optional"
            />
          </div>

          <div>
            <label htmlFor="health_notes" className="block text-sm font-medium mb-1">
              Notes
            </label>
            <textarea
              id="health_notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full px-3 py-2 border border-border rounded-card bg-background text-base"
            />
          </div>

          {!hasConsent && (
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="health_consent"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-1 h-4 w-4 rounded"
              />
              <label htmlFor="health_consent" className="text-sm">
                I understand that this diary is private and that it is not medical advice.
              </label>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Save entry'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
