'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MEAL_SLOTS, MEAL_SLOT_LABELS, weekdayIndex } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { addDays, formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { MealPlanEntry, MealSlot, Recipe, User } from '@/lib/types';
import { AddToShoppingDialog } from './add-to-shopping-dialog';

const STATUS_LABELS: Record<MealPlanEntry['status'], string> = {
  planned: 'Planned',
  cooked: 'Cooked',
  skipped: 'Skipped',
};

const WEEKDAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
});

const DAY_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
  month: 'short',
});

function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

function dayHeading(day: string): string {
  const date = new Date(`${day}T12:00:00Z`);
  return `${WEEKDAY_FORMAT.format(date)} ${DAY_FORMAT.format(date)}`;
}

function SlotCell({
  day,
  slot,
  entry,
  onAdd,
  onEdit,
  onToggleStatus,
  onRemove,
  onShopping,
}: {
  day: string;
  slot: MealSlot;
  entry?: MealPlanEntry;
  onAdd: (day: string, slot: MealSlot) => void;
  onEdit: (entry: MealPlanEntry) => void;
  onToggleStatus: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
  onShopping: (entry: MealPlanEntry) => void;
}) {
  if (!entry) {
    return (
      <button
        type="button"
        onClick={() => onAdd(day, slot)}
        className="h-full min-h-[44px] w-full rounded-card border border-dashed border-border px-2 py-2 text-xs text-secondary hover:bg-surface"
      >
        + Add meal
      </button>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-card border border-border p-2">
      <div>
        <p className="text-sm font-medium leading-snug break-words">{entry.recipe_title}</p>
        <p className="mt-0.5 text-xs text-secondary">
          {entry.servings} {entry.servings === 1 ? 'serving' : 'servings'}
          {entry.cook_name ? ` • ${entry.cook_name}` : ''}
        </p>
        <p
          className={
            entry.status === 'cooked'
              ? 'mt-0.5 text-xs font-medium text-success'
              : 'mt-0.5 text-xs text-secondary'
          }
        >
          {STATUS_LABELS[entry.status]}
        </p>
      </div>
      <div className="mt-auto grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onEdit(entry)}
          className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1 text-left"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(entry)}
          aria-label={`${entry.status === 'cooked' ? 'Mark planned' : 'Mark cooked'}: ${entry.recipe_title}`}
          className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1 text-left"
        >
          {entry.status === 'cooked' ? 'Planned' : 'Cooked'}
        </button>
        <button
          type="button"
          onClick={() => onShopping(entry)}
          aria-label={`Add ${entry.recipe_title} to shopping`}
          className="text-xs text-secondary hover:text-foreground min-h-[44px] px-1 text-left"
        >
          Shopping
        </button>
        <button
          type="button"
          onClick={() => onRemove(entry)}
          className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1 text-left"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function MealPlan() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(londonDateString()));
  const from = weekStart;
  const to = addDays(weekStart, 6);

  const { data, isLoading, error } = useApiQuery<MealPlanEntry[]>(
    queryKeys.meals.plan(from, to),
    `/api/v1/meals/plan?from=${from}&to=${to}`
  );
  const membersQuery = useApiQuery<User[]>(queryKeys.members, '/api/v1/households/members');
  const entries = data ?? [];
  const members = membersQuery.data ?? [];
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const [actionError, setActionError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingEntry, setEditingEntry] = React.useState<MealPlanEntry | null>(null);
  const [targetDay, setTargetDay] = React.useState<string | null>(null);
  const [targetSlot, setTargetSlot] = React.useState<MealSlot>('dinner');
  const [title, setTitle] = React.useState('');
  const [servings, setServings] = React.useState(4);
  const [cookId, setCookId] = React.useState('');
  const [recipeSource, setRecipeSource] =
    React.useState<MealPlanEntry['recipe_source']>('free_text');
  const [recipeId, setRecipeId] = React.useState<string | null>(null);
  const [recipeQuery, setRecipeQuery] = React.useState('');
  const [recipeResults, setRecipeResults] = React.useState<Recipe[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [shoppingEntry, setShoppingEntry] = React.useState<MealPlanEntry | null>(null);
  const [shoppingOpen, setShoppingOpen] = React.useState(false);

  const resetForm = () => {
    setTitle('');
    setServings(4);
    setCookId('');
    setRecipeSource('free_text');
    setRecipeId(null);
    setRecipeQuery('');
    setRecipeResults([]);
    setSearchError(null);
    setFormError(null);
  };

  const openAdd = (day: string, slot: MealSlot) => {
    setEditingEntry(null);
    setTargetDay(day);
    setTargetSlot(slot);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (entry: MealPlanEntry) => {
    setEditingEntry(entry);
    setTargetDay(entry.date);
    setTargetSlot(entry.slot);
    setTitle(entry.recipe_title);
    setServings(entry.servings);
    setCookId(entry.cook_id ?? '');
    setRecipeSource(entry.recipe_source);
    setRecipeId(entry.recipe_id);
    setRecipeQuery(entry.recipe_title);
    setRecipeResults([]);
    setSearchError(null);
    setFormError(null);
    setDialogOpen(true);
  };

  const searchRecipes = async () => {
    const query = recipeQuery.trim();
    if (!query) {
      setRecipeResults([]);
      return;
    }
    setSearching(true);
    setSearchError(null);
    try {
      const result = await apiFetch<{ items: Recipe[] }>(
        `/api/v1/recipes?q=${encodeURIComponent(query)}`
      );
      setRecipeResults(result.items);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Could not search recipes');
    } finally {
      setSearching(false);
    }
  };

  const chooseRecipe = (recipe: Recipe) => {
    setTitle(recipe.title);
    setRecipeSource(recipe.source);
    setRecipeId(recipe.id);
    setRecipeResults([]);
  };

  const clearRecipe = () => {
    setRecipeSource('free_text');
    setRecipeId(null);
    setRecipeResults([]);
  };

  const saveMeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!targetDay || !title.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiFetch('/api/v1/meals/plan', {
        method: 'PUT',
        body: JSON.stringify({
          date: targetDay,
          slot: targetSlot,
          recipe_source: recipeSource,
          recipe_id: recipeSource === 'free_text' ? null : recipeId,
          recipe_title: title.trim(),
          servings,
          cook_id: cookId || null,
          status: editingEntry?.status ?? 'planned',
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.plan(from, to) });
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (entry: MealPlanEntry) => {
    setActionError(null);
    try {
      await apiFetch('/api/v1/meals/plan', {
        method: 'PUT',
        body: JSON.stringify({
          date: entry.date,
          slot: entry.slot,
          recipe_source: entry.recipe_source,
          recipe_id: entry.recipe_id,
          recipe_title: entry.recipe_title,
          servings: entry.servings,
          cook_id: entry.cook_id,
          status: entry.status === 'cooked' ? 'planned' : 'cooked',
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.plan(from, to) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update meal status');
    }
  };

  const removeEntry = async (entry: MealPlanEntry) => {
    if (!(await confirm('Remove this planned meal?'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/meals/plan/${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.plan(from, to) });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove planned meal');
    }
  };

  const openShopping = (entry: MealPlanEntry) => {
    setShoppingEntry(entry);
    setShoppingOpen(true);
  };

  const findEntry = (day: string, slot: MealSlot) =>
    entries.find((entry) => entry.date === day && entry.slot === slot);

  const slotCellProps = (day: string, slot: MealSlot) => ({
    day,
    slot,
    entry: findEntry(day, slot),
    onAdd: openAdd,
    onEdit: openEdit,
    onToggleStatus: toggleStatus,
    onRemove: removeEntry,
    onShopping: openShopping,
  });

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Week plan</h2>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading the week plan...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Week plan</h2>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load the week plan.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Week plan</h2>
          <p className="text-sm text-secondary">
            {formatUkDate(from)} – {formatUkDate(to)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWeekStart((current) => addDays(current, -7))}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWeekStart(startOfWeek(londonDateString()))}
          >
            Today
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setWeekStart((current) => addDays(current, 7))}
          >
            Next
          </Button>
        </div>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load the week plan.')}
        </div>
      )}

      {entries.length === 0 && (
        <EmptyState
          title="Nothing planned this week"
          description="Add meals to each day and the shopping list can pick up the ingredients."
          actionLabel="Add a meal"
          onAction={() => {
            const today = londonDateString();
            const day = today >= from && today <= to ? today : from;
            openAdd(day, 'dinner');
          }}
        />
      )}

      <div className="hidden md:block">
        <div className="grid grid-cols-[5.5rem_repeat(7,minmax(0,1fr))] gap-2">
          <div />
          {days.map((day) => (
            <div key={`heading-${day}`} className="pb-1 text-xs font-semibold text-secondary">
              {dayHeading(day)}
            </div>
          ))}
          {MEAL_SLOTS.map((slot) => (
            <React.Fragment key={slot}>
              <div className="pt-2 text-xs font-semibold text-secondary">
                {MEAL_SLOT_LABELS[slot]}
              </div>
              {days.map((day) => (
                <SlotCell key={`${day}-${slot}`} {...slotCellProps(day, slot)} />
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="space-y-3 md:hidden">
        {days.map((day) => (
          <Card key={day} className="space-y-2">
            <h3 className="text-sm font-semibold">{dayHeading(day)}</h3>
            {MEAL_SLOTS.map((slot) => (
              <div key={slot} className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-2">
                <div className="pt-2 text-xs font-semibold text-secondary">
                  {MEAL_SLOT_LABELS[slot]}
                </div>
                <SlotCell {...slotCellProps(day, slot)} />
              </div>
            ))}
          </Card>
        ))}
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editingEntry ? 'Edit planned meal' : 'Add planned meal'}
      >
        <form onSubmit={saveMeal} className="space-y-4">
          {formError && (
            <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
              {formError}
            </div>
          )}

          <p className="text-xs text-secondary">
            {targetDay ? dayHeading(targetDay) : ''} • {MEAL_SLOT_LABELS[targetSlot]}
          </p>

          <div>
            <label htmlFor="meal_title" className="block text-sm font-medium mb-1">
              Meal
            </label>
            <Input
              id="meal_title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Roast chicken"
            />
          </div>

          <div>
            <label htmlFor="meal_search" className="block text-sm font-medium mb-1">
              Find a recipe (optional)
            </label>
            <div className="flex gap-2">
              <Input
                id="meal_search"
                value={recipeQuery}
                onChange={(event) => setRecipeQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    searchRecipes();
                  }
                }}
                placeholder="Search recipes"
                className="flex-1 min-w-0"
              />
              <Button
                type="button"
                variant="secondary"
                onClick={searchRecipes}
                disabled={searching}
              >
                {searching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            {searchError && (
              <p role="alert" className="mt-2 text-xs text-destructive">
                {searchError}
              </p>
            )}
            {recipeResults.length > 0 && (
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-card border border-border p-1">
                {recipeResults.map((recipe) => (
                  <li key={`${recipe.source}-${recipe.id}`}>
                    <button
                      type="button"
                      onClick={() => chooseRecipe(recipe)}
                      className="flex min-h-[44px] w-full flex-wrap items-baseline gap-x-2 rounded-card px-2 py-2 text-left text-sm hover:bg-surface"
                    >
                      <span className="font-medium">{recipe.title}</span>
                      <span className="text-xs text-secondary">
                        {recipe.source === 'household' ? 'Household' : 'Catalogue'}
                        {recipe.total_minutes ? ` • ${recipe.total_minutes} min` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {recipeId ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-secondary">
                <span>
                  Using a {recipeSource === 'household' ? 'household' : 'catalogue'} recipe.
                </span>
                <button
                  type="button"
                  onClick={clearRecipe}
                  className="min-h-[44px] px-1 text-secondary hover:text-foreground"
                >
                  Use free text
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-secondary">
                No recipe linked. The meal is saved as free text.
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="meal_servings" className="block text-sm font-medium mb-1">
                Servings
              </label>
              <Input
                id="meal_servings"
                type="number"
                min="1"
                max="50"
                value={servings}
                onChange={(event) =>
                  setServings(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </div>
            <div>
              <label htmlFor="meal_cook" className="block text-sm font-medium mb-1">
                Cook
              </label>
              <select
                id="meal_cook"
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
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save meal'}
            </Button>
          </div>
        </form>
      </Dialog>

      <AddToShoppingDialog
        entry={shoppingEntry}
        open={shoppingOpen}
        onClose={() => setShoppingOpen(false)}
        onAdded={() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.meals.plan(from, to) });
        }}
      />
    </div>
  );
}
