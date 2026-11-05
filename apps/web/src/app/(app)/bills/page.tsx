'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { formatUkDate } from '@/lib/dates';
import { Bill } from '@/lib/types';
import { formatPenceToPounds } from '@/lib/utils';

export default function BillsPage() {
  const [bills, setBills] = React.useState<Bill[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  // Form state
  const [name, setName] = React.useState('');
  const [provider, setProvider] = React.useState('');
  const [amountPounds, setAmountPounds] = React.useState('');
  const [frequency, setFrequency] = React.useState('monthly');
  const [nextDueDate, setNextDueDate] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  const loadBills = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<Bill[]>('/api/v1/bills');
      setBills(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bills');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadBills();
  }, []);

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
      const newBill = await apiFetch<Bill>('/api/v1/bills', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          provider: provider.trim() || null,
          amount_pence: amountPence,
          frequency,
          next_due_date: nextDueDate || null,
        }),
      });
      setBills((prev) => [...prev, newBill]);
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
    setError(null);
    try {
      const updated = await apiFetch<Bill>(`/api/v1/bills/${id}/pay`, { method: 'POST' });
      setBills((prev) =>
        updated.is_active
          ? prev.map((bill) => (bill.id === id ? updated : bill))
          : prev.filter((bill) => bill.id !== id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update bill');
    }
  };

  const deleteBill = async (id: string) => {
    if (!window.confirm('Delete this bill? This cannot be undone.')) return;
    setError(null);
    try {
      await apiFetch(`/api/v1/bills/${id}`, { method: 'DELETE' });
      setBills((prev) => prev.filter((bill) => bill.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete bill');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Household bills</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household bills and recurring commitments...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Household bills</h1>
          <p className="text-sm text-secondary">
            Shared utilities, council tax, rent, and household subscriptions.
          </p>
        </div>
        <Button onClick={openCreateDialog}>Add bill</Button>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {error}
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
        <div className="grid gap-3 sm:grid-cols-2">
          {bills.map((bill) => (
            <Card key={bill.id} className="border-2">
              <CardContent>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base">{bill.name}</h3>
                    <p className="text-xs text-secondary mt-0.5">
                      {bill.provider ? `${bill.provider} • ` : ''}
                      Repeats {bill.frequency}
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
                    <span className="text-base font-bold block">
                      {formatPenceToPounds(bill.amount_pence)}
                    </span>
                    <Button
                      onClick={() => payBill(bill.id)}
                      variant="secondary"
                      className="text-xs px-3 py-1"
                    >
                      Mark paid
                    </Button>
                    <button
                      onClick={() => deleteBill(bill.id)}
                      className="block ml-auto text-xs text-secondary hover:text-destructive"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
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
