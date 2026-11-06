'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { daysBetween } from '@chores/domain';
import { apiFetch } from '@/lib/api';
import { addDays, dueLabel, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Bill } from '@/lib/types';
import { formatPenceToPounds } from '@/lib/utils';

function BillRow({
  bill,
  today,
  onPay,
  onEdit,
  onDelete,
}: {
  bill: Bill;
  today: string;
  onPay: (id: string) => void;
  onEdit: (bill: Bill) => void;
  onDelete: (id: string) => void;
}) {
  const overdue = Boolean(bill.next_due_date && bill.next_due_date < today);
  const daysOverdue =
    overdue && bill.next_due_date ? daysBetween(bill.next_due_date, today) : 0;
  const dueText = bill.next_due_date
    ? overdue
      ? daysOverdue === 1
        ? '1 day overdue'
        : `${daysOverdue} days overdue`
      : dueLabel(bill.next_due_date, today)
    : null;

  return (
    <div
      id={`bill-${bill.id}`}
      className="border border-border rounded-card p-3 scroll-mt-24 target:bg-surface"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-base leading-snug break-words">
            {bill.name}
          </h3>
          <p className="text-xs text-secondary mt-0.5 break-words">
            {bill.provider ? `${bill.provider} • ` : ''}
            Repeats {bill.frequency.replace('_', ' ')}
          </p>
          {dueText && (
            <p
              className={
                overdue
                  ? 'text-xs text-destructive font-medium mt-1'
                  : 'text-xs text-secondary mt-1'
              }
            >
              {dueText}
            </p>
          )}
        </div>
        <div className="text-right">
          <span className="text-base font-semibold tabular-nums whitespace-nowrap block">
            {formatPenceToPounds(bill.amount_pence)}
          </span>
        </div>
        <div className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
          <Button
            onClick={() => onPay(bill.id)}
            variant="secondary"
            className="text-xs px-3"
            aria-label={`Mark ${bill.name} as paid`}
          >
            Mark paid
          </Button>
          <button
            type="button"
            onClick={() => onEdit(bill)}
            className="inline-flex min-h-[44px] items-center rounded-btn px-2 text-xs text-secondary hover:text-foreground"
            aria-label={`Edit ${bill.name}`}
          >
            Edit
          </button>
          <button
            type="button"
            onClick={() => onDelete(bill.id)}
            className="inline-flex min-h-[44px] items-center rounded-btn px-2 text-xs text-secondary hover:text-destructive"
            aria-label={`Remove ${bill.name}`}
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillsPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading, error, refetch } = useApiQuery<Bill[]>(
    queryKeys.bills,
    '/api/v1/bills'
  );
  const bills = data ?? [];
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [amountPounds, setAmountPounds] = React.useState('');
  const [frequency, setFrequency] = React.useState('monthly');
  const [nextDueDate, setNextDueDate] = React.useState('');
  const [paymentMethod, setPaymentMethod] = React.useState('');
  const [accountReference, setAccountReference] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [reminderDays, setReminderDays] = React.useState('');
  const [reminderTime, setReminderTime] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setProvider('');
    setAmountPounds('');
    setFrequency('monthly');
    setNextDueDate('');
    setPaymentMethod('');
    setAccountReference('');
    setNotes('');
    setReminderDays('');
    setReminderTime('');
    setFormError(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (bill: Bill) => {
    setEditingId(bill.id);
    setName(bill.name);
    setProvider(bill.provider ?? '');
    setAmountPounds(
      bill.amount_pence === null ? '' : (bill.amount_pence / 100).toFixed(2)
    );
    setFrequency(bill.frequency);
    setNextDueDate(bill.next_due_date ?? '');
    setPaymentMethod(bill.payment_method ?? '');
    setAccountReference(bill.account_reference ?? '');
    setNotes(bill.notes ?? '');
    setReminderDays(
      bill.reminder_days_before === null || bill.reminder_days_before === undefined
        ? ''
        : String(bill.reminder_days_before)
    );
    setReminderTime(bill.reminder_time ?? '');
    setFormError(null);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const amountPence = amountPounds ? Math.round(parseFloat(amountPounds) * 100) : null;
      await apiFetch(editingId ? `/api/v1/bills/${editingId}` : '/api/v1/bills', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({
          name: name.trim(),
          provider: provider.trim() || null,
          amount_pence: amountPence,
          frequency,
          next_due_date: nextDueDate || null,
          payment_method: paymentMethod.trim() || null,
          account_reference: accountReference.trim() || null,
          notes: notes.trim() || null,
          reminder_days_before:
            reminderDays === '' ? null : Number(reminderDays),
          reminder_time: reminderTime || null,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills });
      setDialogOpen(false);
      resetForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save bill');
    } finally {
      setSubmitting(false);
    }
  };

  const payBill = async (id: string) => {
    setActionError(null);
    try {
      await apiFetch(`/api/v1/bills/${id}/pay`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update bill');
    }
  };

  const deleteBill = async (id: string) => {
    if (!(await confirm('Delete this bill? This cannot be undone.'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/bills/${id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete bill');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Household bills</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading household bills...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Household bills</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load bills.'}
        </div>
        <Button onClick={() => refetch()} variant="secondary">
          Try again
        </Button>
      </div>
    );
  }

  const today = londonDateString();
  const weekEnd = addDays(today, 7);
  const upcomingBills = bills.filter(
    (bill) =>
      bill.next_due_date &&
      bill.next_due_date >= today &&
      bill.next_due_date <= weekEnd
  );
  const upcomingStated = upcomingBills.filter(
    (bill) => bill.amount_pence !== null
  );
  const upcomingTotal = upcomingStated.reduce(
    (total, bill) => total + (bill.amount_pence ?? 0),
    0
  );
  const upcomingWithoutAmount = upcomingBills.length - upcomingStated.length;

  const sortByDueDate = (items: Bill[]) =>
    [...items].sort(
      (a, b) =>
        (a.next_due_date ?? '').localeCompare(b.next_due_date ?? '') ||
        a.name.localeCompare(b.name)
    );

  const groups = [
    {
      title: 'Overdue',
      items: bills.filter(
        (bill) => bill.next_due_date && bill.next_due_date < today
      ),
    },
    {
      title: 'Due today',
      items: bills.filter((bill) => bill.next_due_date === today),
    },
    {
      title: 'Next 7 days',
      items: bills.filter(
        (bill) =>
          bill.next_due_date &&
          bill.next_due_date > today &&
          bill.next_due_date <= weekEnd
      ),
    },
    {
      title: 'Later',
      items: bills.filter(
        (bill) => bill.next_due_date && bill.next_due_date > weekEnd
      ),
    },
    {
      title: 'No date',
      items: bills.filter((bill) => !bill.next_due_date),
    },
  ].map((group) => ({ ...group, items: sortByDueDate(group.items) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Household bills</h1>
          <p className="text-sm text-secondary">
            Shared utilities, council tax, rent, and household subscriptions.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add bill</Button>
      </div>

      {actionError && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError}
        </div>
      )}

      {bills.length === 0 ? (
        <EmptyState
          title="No bills tracked yet"
          description="Keep track of recurring energy, council tax, broadband, and joint accounts."
          actionLabel="Add your first bill"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-6">
          {upcomingBills.length === 0 ? (
            <p className="text-sm text-secondary">
              Nothing due today or in the next 7 days.
            </p>
          ) : upcomingStated.length === 0 ? (
            <p className="text-sm text-secondary">
              {upcomingBills.length}{' '}
              {upcomingBills.length === 1 ? 'bill' : 'bills'} due today or in the
              next 7 days. No amounts set.
            </p>
          ) : (
            <p className="text-sm text-secondary">
              <span className="text-base font-semibold text-foreground tabular-nums">
                {formatPenceToPounds(upcomingTotal)}
              </span>{' '}
              due today or in the next 7 days across {upcomingBills.length}{' '}
              {upcomingBills.length === 1 ? 'bill' : 'bills'}.
              {upcomingWithoutAmount > 0 && (
                <>
                  {' '}
                  {upcomingWithoutAmount}{' '}
                  {upcomingWithoutAmount === 1 ? 'bill has' : 'bills have'} no
                  amount.
                </>
              )}
            </p>
          )}

          <div className="space-y-8">
            {groups
              .filter((group) => group.items.length > 0)
              .map((group) => (
                <section key={group.title} className="space-y-3">
                  <h2 className="text-lg font-semibold border-b border-border pb-2">
                    {group.title}
                  </h2>
                  <div className="space-y-2">
                    {group.items.map((bill) => (
                      <BillRow
                        key={bill.id}
                        bill={bill}
                        today={today}
                        onPay={payBill}
                        onEdit={openEditDialog}
                        onDelete={deleteBill}
                      />
                    ))}
                  </div>
                </section>
              ))}
          </div>
        </div>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingId ? 'Edit household bill' : 'Add household bill'}
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
            <label htmlFor="bill_name" className="block text-sm font-medium mb-1">
              Bill / Commitment name
            </label>
            <Input
              id="bill_name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Council Tax, Energy"
            />
          </div>

          <div>
            <label htmlFor="bill_provider" className="block text-sm font-medium mb-1">
              Provider (optional)
            </label>
            <Input
              id="bill_provider"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              placeholder="e.g. Octopus Energy"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill_amount" className="block text-sm font-medium mb-1">
                Amount (£)
              </label>
              <Input
                id="bill_amount"
                type="number"
                step="0.01"
                min="0"
                value={amountPounds}
                onChange={(e) => setAmountPounds(e.target.value)}
                placeholder="85.50"
              />
            </div>
            <div>
              <label htmlFor="bill_frequency" className="block text-sm font-medium mb-1">
                Frequency
              </label>
              <select
                id="bill_frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
                className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
              >
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="weekly">Weekly</option>
                <option value="one_off">One-off</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="bill_due" className="block text-sm font-medium mb-1">
              Next due date (optional)
            </label>
            <Input
              id="bill_due"
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill_payment" className="block text-sm font-medium mb-1">
                Payment method (optional)
              </label>
              <Input
                id="bill_payment"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder="Direct debit"
              />
            </div>
            <div>
              <label htmlFor="bill_reference" className="block text-sm font-medium mb-1">
                Account reference (optional)
              </label>
              <Input
                id="bill_reference"
                value={accountReference}
                onChange={(e) => setAccountReference(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="bill_notes" className="block text-sm font-medium mb-1">
              Notes (optional)
            </label>
            <textarea
              id="bill_notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-card bg-background text-base"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="bill_reminder_days" className="block text-sm font-medium mb-1">
                Remind days before
              </label>
              <Input
                id="bill_reminder_days"
                type="number"
                min="0"
                max="60"
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                placeholder="Household default"
              />
            </div>
            <div>
              <label htmlFor="bill_reminder_time" className="block text-sm font-medium mb-1">
                Reminder time
              </label>
              <Input
                id="bill_reminder_time"
                type="time"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Save bill'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
