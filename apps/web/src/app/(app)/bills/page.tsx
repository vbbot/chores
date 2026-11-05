'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { addDays, formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Bill } from '@/lib/types';
import { formatPenceToPounds } from '@/lib/utils';

function BillRow({
  bill,
  onPay,
  onDelete,
}: {
  bill: Bill;
  onPay: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="border border-border rounded-card p-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="font-semibold text-base">{bill.name}</h3>
        <p className="text-xs text-secondary mt-0.5">
          {bill.provider ? `${bill.provider} • ` : ''}
          Repeats {bill.frequency.replace('_', ' ')}
        </p>
        {bill.next_due_date && (
          <p className="text-xs text-secondary mt-1">
            Next due:{' '}
            <span className="text-foreground font-medium">
              {formatUkDate(bill.next_due_date)}
            </span>
          </p>
        )}
      </div>
      <div className="text-right space-y-2">
        <span className="text-base font-semibold block tabular-nums">
          {formatPenceToPounds(bill.amount_pence)}
        </span>
        <div className="flex items-center justify-end gap-2">
          <Button
            onClick={() => onPay(bill.id)}
            variant="secondary"
            className="text-xs px-3 py-1"
          >
            Mark paid
          </Button>
          <button
            onClick={() => onDelete(bill.id)}
            className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BillsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useApiQuery<Bill[]>(queryKeys.bills, '/api/v1/bills');
  const bills = data ?? [];
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const [name, setName] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [amountPounds, setAmountPounds] = React.useState('');
  const [frequency, setFrequency] = React.useState('monthly');
  const [nextDueDate, setNextDueDate] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const openCreateDialog = () => {
    setFormError(null);
    setDialogOpen(true);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      const amountPence = amountPounds ? Math.round(parseFloat(amountPounds) * 100) : null;
      await apiFetch('/api/v1/bills', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          provider: provider.trim() || null,
          amount_pence: amountPence,
          frequency,
          next_due_date: nextDueDate || null,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.bills });
      setDialogOpen(false);
      setName('');
      setProvider('');
      setAmountPounds('');
      setNextDueDate('');
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
    if (!window.confirm('Delete this bill? This cannot be undone.')) return;
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
      </div>
    );
  }

  const today = londonDateString();
  const soon = addDays(today, 7);
  const dueSoon = bills.filter((bill) => bill.next_due_date && bill.next_due_date <= soon);
  const later = bills.filter((bill) => bill.next_due_date && bill.next_due_date > soon);
  const noDate = bills.filter((bill) => !bill.next_due_date);

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
        <div className="space-y-8">
          {[
            { title: 'Due soon', items: dueSoon },
            { title: 'Later', items: later },
            { title: 'No date', items: noDate },
          ]
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
                      onPay={payBill}
                      onDelete={deleteBill}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add household bill">
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

          <div className="flex justify-end space-x-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save bill'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
