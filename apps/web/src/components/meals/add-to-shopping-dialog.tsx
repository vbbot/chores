'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { queryKeys } from '@/lib/query-keys';
import { MealPlanEntry, MealShoppingResult } from '@/lib/types';

export type ShoppingTarget =
  | { kind: 'plan'; entry: MealPlanEntry }
  | {
      kind: 'recipe';
      source: 'catalogue' | 'household';
      id: string;
      title: string;
      servings: number;
    };

interface AddToShoppingDialogProps {
  open: boolean;
  target?: ShoppingTarget | null;
  /** @deprecated Use target. Kept for the old plan grid. */
  entry?: MealPlanEntry | null;
  onClose: () => void;
  onAdded?: () => void;
}

export function AddToShoppingDialog({
  open,
  target,
  entry,
  onClose,
  onAdded,
}: AddToShoppingDialogProps) {
  const queryClient = useQueryClient();
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<MealShoppingResult | null>(null);

  const resolved: ShoppingTarget | null =
    target ?? (entry ? { kind: 'plan', entry } : null);

  React.useEffect(() => {
    if (!open) return;
    setSubmitting(false);
    setError(null);
    setResult(null);
  }, [open, resolved?.kind, resolved?.kind === 'plan' ? resolved.entry.id : resolved?.id]);

  const planEntry = resolved?.kind === 'plan' ? resolved.entry : null;
  const recipe = resolved?.kind === 'recipe' ? resolved : null;
  const freeText = planEntry
    ? planEntry.recipe_source === 'free_text' || !planEntry.recipe_id
    : false;
  const title = planEntry?.recipe_title ?? recipe?.title ?? '';
  const servings = planEntry?.servings ?? recipe?.servings ?? 0;

  const addIngredients = async () => {
    if (!resolved) return;
    setSubmitting(true);
    setError(null);
    try {
      const response =
        resolved.kind === 'plan'
          ? await apiFetch<MealShoppingResult>(
              `/api/v1/meals/plan/${encodeURIComponent(resolved.entry.id)}/shopping`,
              { method: 'POST', body: JSON.stringify({}) }
            )
          : await apiFetch<MealShoppingResult>(
              `/api/v1/recipes/${encodeURIComponent(resolved.id)}/shopping`,
              {
                method: 'POST',
                body: JSON.stringify({
                  source: resolved.source,
                  servings: resolved.servings,
                }),
              }
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
        {title && (
          <p className="text-sm">
            {title} for {servings} {servings === 1 ? 'serving' : 'servings'}.
            Ingredient quantities scale to these servings.
          </p>
        )}

        {freeText && (
          <p className="text-sm text-secondary">
            This meal is free text, so there are no recipe ingredients to add. Choose a
            recipe from the slot's recipe search to replace it, then add those ingredients.
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
                disabled={submitting || freeText || !resolved}
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
