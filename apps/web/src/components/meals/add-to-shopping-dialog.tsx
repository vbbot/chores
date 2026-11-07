'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { MealPlanEntry, MealShoppingResult } from '@/lib/types';

interface AddToShoppingDialogProps {
  entry: MealPlanEntry | null;
  open: boolean;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddToShoppingDialog({
  entry,
  open,
  onClose,
  onAdded,
}: AddToShoppingDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<MealShoppingResult | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, [open, entry?.id]);

  const freeText = !entry || entry.recipe_source === 'free_text' || !entry.recipe_id;

  const addIngredients = async () => {
    if (!entry || freeText) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await apiFetch<MealShoppingResult>(
        `/api/v1/meals/plan/${encodeURIComponent(entry.id)}/shopping`,
        { method: 'POST', body: JSON.stringify({}) }
      );
      setResult(response);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.shopping }),
        queryClient.invalidateQueries({ queryKey: ['meals', 'plan'] }),
      ]);
      onAdded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add ingredients');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Add ingredients to shopping">
      <div className="space-y-4">
        {entry && (
          <p className="text-sm">
            {entry.recipe_title} for {entry.servings}{' '}
            {entry.servings === 1 ? 'serving' : 'servings'}. Ingredient quantities scale to
            the planned servings.
          </p>
        )}

        {freeText && (
          <p className="text-sm text-secondary">
            This meal is free text, so there are no recipe ingredients to add. Edit the meal
            and link a recipe to use this.
          </p>
        )}

        {error && (
          <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-2">
            <p className="text-sm">
              {result.added} added, {result.merged} merged, {result.skipped} skipped.
            </p>
            {result.items.length > 0 && (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-border p-2 text-sm">
                {result.items.map((item, index) => (
                  <li
                    key={`${item.name}-${index}`}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span>{item.name}</span>
                    {(item.quantity !== null || item.unit) && (
                      <span className="text-xs text-secondary">
                        {item.quantity ?? ''}
                        {item.unit ? ` ${item.unit}` : ''}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          {result ? (
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={addIngredients}
                disabled={submitting || freeText || !entry}
              >
                {submitting ? 'Adding...' : 'Add ingredients'}
              </Button>
            </>
          )}
        </div>
      </div>
    </Dialog>
  );
}
