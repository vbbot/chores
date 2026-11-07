'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MEAL_SLOT_LABELS, MEAL_SLOTS } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { addDays, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { MealSlot, User } from '@/lib/types';

export type MealAction = 'plan' | 'suggest';

export interface RecipeTarget {
  source: 'catalogue' | 'household';
  id: string;
  title: string;
  servings: number;
}

interface MealActionDialogProps {
  open: boolean;
  action: MealAction;
  recipe: RecipeTarget | null;
  defaultDate?: string | null;
  defaultSlot?: MealSlot | null;
  onClose: () => void;
  onDone?: (action: MealAction) => void;
}

export function MealActionDialog({
  open,
  action,
  recipe,
  defaultDate,
  defaultSlot,
  onClose,
  onDone,
}: MealActionDialogProps) {
  const queryClient = useQueryClient();
  const membersQuery = useApiQuery<User[]>(
    queryKeys.members,
    '/api/v1/households/members',
    { enabled: open }
  );
  const members = membersQuery.data ?? [];

  const [date, setDate] = React.useState(defaultDate ?? londonDateString());
  const [slot, setSlot] = React.useState<MealSlot>(defaultSlot ?? 'dinner');
  const [servings, setServings] = React.useState(recipe?.servings ?? 4);
  const [cookId, setCookId] = React.useState('');
  const [serveTime, setServeTime] = React.useState('');
  const [note, setNote] = React.useState('');
  const [anyTime, setAnyTime] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setDate(defaultDate ?? londonDateString());
    setSlot(defaultSlot ?? 'dinner');
    setServings(recipe?.servings ?? 4);
    setCookId('');
    setServeTime('');
    setNote('');
    setAnyTime(false);
    setSaving(false);
    setError(null);
  }, [open, defaultDate, defaultSlot, recipe?.id, recipe?.servings]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipe) return;
    setSaving(true);
    setError(null);
    try {
      if (action === 'plan') {
        await apiFetch('/api/v1/meals/plan', {
          method: 'PUT',
          body: JSON.stringify({
            date,
            slot,
            recipe_source: recipe.source,
            recipe_id: recipe.id,
            recipe_title: recipe.title,
            servings,
            cook_id: cookId || null,
            serve_time: serveTime || null,
            status: 'planned',
          }),
        });
      } else {
        await apiFetch('/api/v1/meals/ideas', {
          method: 'POST',
          body: JSON.stringify({
            title: recipe.title,
            recipe_source: recipe.source,
            recipe_id: recipe.id,
            note: note.trim() || null,
            suggested_for_date: anyTime ? null : date,
            suggested_for_slot: anyTime ? null : slot,
          }),
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['meals'] });
      onDone?.(action);
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : action === 'plan'
            ? 'Could not plan this meal.'
            : 'Could not suggest this meal.'
      );
    } finally {
      setSaving(false);
    }
  };

  const title = action === 'plan' ? 'Plan this meal' : 'Suggest this meal';
  const actionLabel = action === 'plan' ? 'Plan meal' : 'Suggest meal';

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {recipe ? (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm">
            <span className="font-semibold">{recipe.title}</span>
            <span className="text-secondary">
              {' '}
              · serves {recipe.servings}
            </span>
          </p>

          {error && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {error}
            </div>
          )}

          {action === 'suggest' && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={anyTime}
                onChange={(event) => setAnyTime(event.target.checked)}
                className="mt-1 h-4 w-4 rounded"
              />
              <span>
                Save as an idea for any time
                <span className="block text-xs text-secondary">
                  Leave unticked to suggest it for a specific day and meal.
                </span>
              </span>
            </label>
          )}

          {!anyTime && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="meal_action_date" className="block text-sm font-medium mb-1">
                  Day
                </label>
                <Input
                  id="meal_action_date"
                  type="date"
                  required={action === 'plan' || !anyTime}
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="meal_action_slot" className="block text-sm font-medium mb-1">
                  Meal
                </label>
                <select
                  id="meal_action_slot"
                  value={slot}
                  onChange={(event) => setSlot(event.target.value as MealSlot)}
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  {MEAL_SLOTS.map((value) => (
                    <option key={value} value={value}>
                      {MEAL_SLOT_LABELS[value]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {action === 'plan' && (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="meal_action_servings" className="block text-sm font-medium mb-1">
                    Servings
                  </label>
                  <Input
                    id="meal_action_servings"
                    type="number"
                    min={1}
                    max={100}
                    value={servings}
                    onChange={(event) =>
                      setServings(Math.max(1, Number(event.target.value) || 1))
                    }
                  />
                </div>
                <div>
                  <label htmlFor="meal_action_time" className="block text-sm font-medium mb-1">
                    Serve time (optional)
                  </label>
                  <Input
                    id="meal_action_time"
                    type="time"
                    value={serveTime}
                    onChange={(event) => setServeTime(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="meal_action_cook" className="block text-sm font-medium mb-1">
                  Cook
                </label>
                <select
                  id="meal_action_cook"
                  value={cookId}
                  onChange={(event) => setCookId(event.target.value)}
                  className="w-full h-11 px-3 border border-border rounded-card bg-background text-base"
                >
                  <option value="">Anyone</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {action === 'suggest' && (
            <div>
              <label htmlFor="meal_action_note" className="block text-sm font-medium mb-1">
                Note (optional)
              </label>
              <textarea
                id="meal_action_note"
                rows={2}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Why this meal?"
                className="w-full px-3 py-2 border border-border rounded-card bg-background text-base"
              />
            </div>
          )}

          <p className="text-xs text-secondary">
            {action === 'plan'
              ? 'This replaces any meal already planned for that slot.'
              : 'You vote for your own suggestion automatically.'}
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : actionLabel}
            </Button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-secondary">Choose a recipe first.</p>
      )}
    </Dialog>
  );
}
