'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { MEAL_SLOTS, MEAL_SLOT_LABELS, weekdayIndex } from '@chores/domain';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { addDays, formatUkDate, londonDateString } from '@/lib/dates';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { MealIdea, MealPlanEntry, MealSlot, Recipe, User } from '@/lib/types';
import { AddToShoppingDialog } from './add-to-shopping-dialog';
import { MealActionDialog } from './meal-action-dialog';
import type { RecipeTarget } from './meal-action-dialog';

const STATUS_LABELS: Record<MealPlanEntry['status'], string> = {
  planned: 'Planned',
  cooked: 'Cooked',
  skipped: 'Skipped',
};

const WEEKDAY_SHORT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'short',
});

const DAY_NUMBER = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  day: 'numeric',
});

const MONTH_SHORT = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  month: 'short',
});

const FULL_DATE = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

function startOfWeek(day: string): string {
  return addDays(day, -weekdayIndex(day));
}

function dateFor(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

function shortDayLabel(day: string): string {
  const date = dateFor(day);
  return `${WEEKDAY_SHORT.format(date)} ${DAY_NUMBER.format(date)}`;
}

function dayHeading(day: string): string {
  const date = dateFor(day);
  return `${WEEKDAY_SHORT.format(date)} ${DAY_NUMBER.format(date)} ${MONTH_SHORT.format(date)}`;
}

function fullDayLabel(day: string): string {
  return FULL_DATE.format(dateFor(day));
}

function serveTimeLabel(value: string): string {
  return value.slice(0, 5);
}

type DialogState =
  | { kind: 'slot'; day: string; slot: MealSlot }
  | { kind: 'edit'; entry: MealPlanEntry }
  | { kind: 'planIdea'; idea: MealIdea }
  | {
      kind: 'action';
      action: 'plan' | 'suggest';
      recipe: RecipeTarget;
      date: string;
      slot: MealSlot;
    }
  | { kind: 'shopping'; entry: MealPlanEntry }
  | null;

interface SlotCellProps {
  day: string;
  slot: MealSlot;
  entry?: MealPlanEntry;
  ideaCount: number;
  onOpen: (day: string, slot: MealSlot) => void;
  onAdd: (day: string, slot: MealSlot) => void;
  onToggleStatus: (entry: MealPlanEntry) => void;
  onRemove: (entry: MealPlanEntry) => void;
  onShopping: (entry: MealPlanEntry) => void;
}

function SlotCell({
  day,
  slot,
  entry,
  ideaCount,
  onOpen,
  onAdd,
  onToggleStatus,
  onRemove,
  onShopping,
}: SlotCellProps) {
  const meal = MEAL_SLOT_LABELS[slot].toLowerCase();
  const fullDay = fullDayLabel(day);

  if (!entry) {
    return (
      <div className="flex h-full flex-col gap-2">
        <button
          type="button"
          onClick={() => onAdd(day, slot)}
          aria-label={`Add ${meal} for ${fullDay}`}
          className="min-h-[44px] w-full rounded-card border border-dashed border-border px-2 py-2 text-xs text-secondary hover:bg-surface"
        >
          + Add {meal} for {shortDayLabel(day)}
        </button>
        {ideaCount > 0 && (
          <div className="rounded-card border border-border p-2">
            <p className="text-xs font-medium">
              {ideaCount} {ideaCount === 1 ? 'idea' : 'ideas'}
            </p>
            <button
              type="button"
              onClick={() => onOpen(day, slot)}
              aria-label={`${ideaCount === 1 ? 'Choose' : 'Review'} ${ideaCount} ${
                ideaCount === 1 ? 'idea' : 'ideas'
              } for ${meal} on ${fullDay}`}
              className="mt-1 min-h-[44px] px-1 text-left text-xs text-secondary hover:text-foreground"
            >
              {ideaCount === 1 ? 'Choose' : 'Review'}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 rounded-card border border-border p-2">
      <div>
        {entry.recipe_source !== 'free_text' && entry.recipe_id ? (
          <Link
            href={`/meals/recipes/${entry.recipe_id}?source=${entry.recipe_source}`}
            className="block min-h-[44px] text-left text-sm font-medium leading-snug break-words underline-offset-4 hover:text-accent hover:underline"
          >
            {entry.recipe_title}
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => onOpen(day, slot)}
            aria-label={`Open ${meal} for ${fullDay}`}
            className="min-h-[44px] w-full text-left text-sm font-medium leading-snug break-words hover:text-accent"
          >
            {entry.recipe_title}
          </button>
        )}
        <p className="mt-0.5 text-xs text-secondary">
          {entry.servings} {entry.servings === 1 ? 'serving' : 'servings'}
          {entry.cook_name ? ` • ${entry.cook_name}` : ''}
        </p>
        {entry.serve_time && (
          <p className="mt-0.5 text-xs text-secondary">
            Served at {serveTimeLabel(entry.serve_time)}
          </p>
        )}
        <p
          className={
            entry.status === 'cooked'
              ? 'mt-0.5 text-xs font-medium text-success'
              : 'mt-0.5 text-xs text-secondary'
          }
        >
          {STATUS_LABELS[entry.status]}
        </p>
        {ideaCount > 0 && (
          <button
            type="button"
            onClick={() => onOpen(day, slot)}
            aria-label={`${ideaCount === 1 ? 'Choose' : 'Review'} ${ideaCount} ${
              ideaCount === 1 ? 'idea' : 'ideas'
            } for ${meal} on ${fullDay}`}
            className="mt-1 min-h-[44px] px-1 text-left text-xs text-secondary hover:text-foreground"
          >
            {ideaCount} {ideaCount === 1 ? 'idea' : 'ideas'} ·{' '}
            {ideaCount === 1 ? 'Choose' : 'Review'}
          </button>
        )}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-1">
        <button
          type="button"
          onClick={() => onOpen(day, slot)}
          aria-label={`Change ${meal} for ${fullDay}`}
          className="min-h-[44px] px-1 text-left text-xs text-secondary hover:text-foreground"
        >
          Change
        </button>
        <button
          type="button"
          onClick={() => onToggleStatus(entry)}
          aria-label={`${
            entry.status === 'cooked' ? 'Mark planned' : 'Mark cooked'
          }: ${entry.recipe_title}`}
          className="min-h-[44px] px-1 text-left text-xs text-secondary hover:text-foreground"
        >
          {entry.status === 'cooked' ? 'Planned' : 'Cooked'}
        </button>
        <button
          type="button"
          onClick={() => onShopping(entry)}
          aria-label={`Add ${entry.recipe_title} to shopping`}
          className="min-h-[44px] px-1 text-left text-xs text-secondary hover:text-foreground"
        >
          Shopping
        </button>
        <button
          type="button"
          onClick={() => onRemove(entry)}
          aria-label={`Remove ${entry.recipe_title}`}
          className="min-h-[44px] px-1 text-left text-xs text-secondary hover:text-destructive"
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export default function MealWeek({
  openIdeasInitially = false,
}: {
  openIdeasInitially?: boolean;
}) {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [weekStart, setWeekStart] = React.useState(() => startOfWeek(londonDateString()));
  const [ideasOpen, setIdeasOpen] = React.useState(openIdeasInitially);
  const [dialog, setDialog] = React.useState<DialogState>(null);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [votingId, setVotingId] = React.useState<string | null>(null);
  const [choosingId, setChoosingId] = React.useState<string | null>(null);

  const [recipeQuery, setRecipeQuery] = React.useState('');
  const [recipeResults, setRecipeResults] = React.useState<Recipe[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [selectedRecipe, setSelectedRecipe] = React.useState<Recipe | null>(null);

  const [suggestionTitle, setSuggestionTitle] = React.useState('');
  const [suggestionNote, setSuggestionNote] = React.useState('');
  const [suggestionSaving, setSuggestionSaving] = React.useState(false);
  const [suggestionError, setSuggestionError] = React.useState<string | null>(null);

  const [planIdeaDate, setPlanIdeaDate] = React.useState(londonDateString());
  const [planIdeaSlot, setPlanIdeaSlot] = React.useState<MealSlot>('dinner');
  const [planIdeaServings, setPlanIdeaServings] = React.useState(4);
  const [planIdeaCook, setPlanIdeaCook] = React.useState('');
  const [planIdeaTime, setPlanIdeaTime] = React.useState('');
  const [planIdeaSaving, setPlanIdeaSaving] = React.useState(false);
  const [planIdeaError, setPlanIdeaError] = React.useState<string | null>(null);

  const [editTitle, setEditTitle] = React.useState('');
  const [editServings, setEditServings] = React.useState(4);
  const [editCook, setEditCook] = React.useState('');
  const [editTime, setEditTime] = React.useState('');
  const [editStatus, setEditStatus] =
    React.useState<MealPlanEntry['status']>('planned');
  const [editSaving, setEditSaving] = React.useState(false);
  const [editError, setEditError] = React.useState<string | null>(null);

  const from = weekStart;
  const to = addDays(weekStart, 6);

  const planQuery = useApiQuery<MealPlanEntry[]>(
    queryKeys.meals.plan(from, to),
    `/api/v1/meals/plan?from=${from}&to=${to}`
  );
  const ideasQuery = useApiQuery<MealIdea[]>(
    queryKeys.meals.ideas,
    '/api/v1/meals/ideas'
  );
  const membersQuery = useApiQuery<User[]>(
    queryKeys.members,
    '/api/v1/households/members'
  );

  const entries = planQuery.data ?? [];
  const ideas = ideasQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const days = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  const invalidatePlan = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.meals.plan(from, to) });
  const invalidateIdeas = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.meals.ideas });

  const findEntry = (day: string, slot: MealSlot) =>
    entries.find((entry) => entry.date === day && entry.slot === slot);

  const activeIdeas = ideas.filter(
    (idea) => idea.status !== 'planned' && idea.status !== 'dismissed'
  );

  const ideasForSlot = (day: string, slot: MealSlot) =>
    activeIdeas.filter(
      (idea) => idea.suggested_for_date === day && idea.suggested_for_slot === slot
    );

  const unscheduledIdeas = activeIdeas.filter(
    (idea) => !idea.suggested_for_date && !idea.suggested_for_slot
  );

  const canManageIdea = (idea: MealIdea) =>
    Boolean(user && (user.role === 'admin' || idea.suggested_by === user.id));

  const resetSlotForm = () => {
    setRecipeQuery('');
    setRecipeResults([]);
    setSearchError(null);
    setSelectedRecipe(null);
    setSuggestionTitle('');
    setSuggestionNote('');
    setSuggestionError(null);
  };

  const openSlot = (day: string, slot: MealSlot) => {
    setActionError(null);
    resetSlotForm();
    setDialog({ kind: 'slot', day, slot });
  };

  const openEdit = (entry: MealPlanEntry) => {
    setActionError(null);
    setEditTitle(entry.recipe_title);
    setEditServings(entry.servings);
    setEditCook(entry.cook_id ?? '');
    setEditTime(entry.serve_time ? serveTimeLabel(entry.serve_time) : '');
    setEditStatus(entry.status);
    setEditError(null);
    setDialog({ kind: 'edit', entry });
  };

  const openPlanIdea = (idea: MealIdea) => {
    setActionError(null);
    setPlanIdeaDate(londonDateString());
    setPlanIdeaSlot('dinner');
    setPlanIdeaServings(4);
    setPlanIdeaCook('');
    setPlanIdeaTime('');
    setPlanIdeaError(null);
    setDialog({ kind: 'planIdea', idea });
  };

  const openShopping = (entry: MealPlanEntry) => {
    setActionError(null);
    setDialog({ kind: 'shopping', entry });
  };

  const closeDialog = () => setDialog(null);

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

  const toggleVote = async (idea: MealIdea) => {
    setActionError(null);
    setVotingId(idea.id);
    queryClient.setQueryData<MealIdea[]>(queryKeys.meals.ideas, (current) =>
      (current ?? []).map((item) =>
        item.id === idea.id
          ? {
              ...item,
              voted_by_me: !item.voted_by_me,
              votes: item.votes + (item.voted_by_me ? -1 : 1),
            }
          : item
      )
    );
    try {
      await apiFetch(`/api/v1/meals/ideas/${encodeURIComponent(idea.id)}/vote`, {
        method: 'POST',
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save your vote');
    } finally {
      setVotingId(null);
      await invalidateIdeas();
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
          serve_time: entry.serve_time,
          idea_id: entry.idea_id,
          status: entry.status === 'cooked' ? 'planned' : 'cooked',
        }),
      });
      await invalidatePlan();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update meal status');
    }
  };

  const removeEntry = async (entry: MealPlanEntry) => {
    setDialog(null);
    if (!(await confirm('Remove this planned meal?'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/meals/plan/${encodeURIComponent(entry.id)}`, {
        method: 'DELETE',
      });
      await invalidatePlan();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove planned meal');
    }
  };

  const removeIdea = async (idea: MealIdea) => {
    setDialog(null);
    if (!(await confirm('Remove this meal idea?'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/meals/ideas/${encodeURIComponent(idea.id)}`, {
        method: 'DELETE',
      });
      await Promise.all([invalidateIdeas(), invalidatePlan()]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove this meal idea');
    }
  };

  const chooseIdea = async (idea: MealIdea, day: string, slot: MealSlot) => {
    setActionError(null);
    setChoosingId(idea.id);
    try {
      await apiFetch('/api/v1/meals/plan', {
        method: 'PUT',
        body: JSON.stringify({
          date: day,
          slot,
          recipe_source: idea.recipe_source,
          recipe_id: idea.recipe_id,
          recipe_title: idea.title,
          servings: 4,
          cook_id: null,
          serve_time: null,
          idea_id: idea.id,
          status: 'planned',
        }),
      });
      await Promise.all([invalidatePlan(), invalidateIdeas()]);
      setDialog(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to plan this meal');
    } finally {
      setChoosingId(null);
    }
  };

  const submitSuggestion = async (event: React.FormEvent, day: string, slot: MealSlot) => {
    event.preventDefault();
    if (!suggestionTitle.trim()) return;
    setSuggestionSaving(true);
    setSuggestionError(null);
    try {
      await apiFetch('/api/v1/meals/ideas', {
        method: 'POST',
        body: JSON.stringify({
          title: suggestionTitle.trim(),
          recipe_source: 'free_text',
          recipe_id: null,
          note: suggestionNote.trim() || null,
          suggested_for_date: day,
          suggested_for_slot: slot,
        }),
      });
      await invalidateIdeas();
      setSuggestionTitle('');
      setSuggestionNote('');
    } catch (err) {
      setSuggestionError(
        err instanceof Error ? err.message : 'Failed to suggest this meal'
      );
    } finally {
      setSuggestionSaving(false);
    }
  };

  const saveEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog?.kind !== 'edit') return;
    const entry = dialog.entry;
    if (!editTitle.trim()) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await apiFetch('/api/v1/meals/plan', {
        method: 'PUT',
        body: JSON.stringify({
          date: entry.date,
          slot: entry.slot,
          recipe_source: entry.recipe_source,
          recipe_id: entry.recipe_id,
          recipe_title: editTitle.trim(),
          servings: editServings,
          cook_id: editCook || null,
          serve_time: editTime || null,
          idea_id: entry.idea_id,
          status: editStatus,
        }),
      });
      await invalidatePlan();
      setDialog(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save meal');
    } finally {
      setEditSaving(false);
    }
  };

  const savePlanIdea = async (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog?.kind !== 'planIdea') return;
    const idea = dialog.idea;
    setPlanIdeaSaving(true);
    setPlanIdeaError(null);
    try {
      await apiFetch('/api/v1/meals/plan', {
        method: 'PUT',
        body: JSON.stringify({
          date: planIdeaDate,
          slot: planIdeaSlot,
          recipe_source: idea.recipe_source,
          recipe_id: idea.recipe_id,
          recipe_title: idea.title,
          servings: planIdeaServings,
          cook_id: planIdeaCook || null,
          serve_time: planIdeaTime || null,
          idea_id: idea.id,
          status: 'planned',
        }),
      });
      await Promise.all([invalidatePlan(), invalidateIdeas()]);
      setDialog(null);
    } catch (err) {
      setPlanIdeaError(err instanceof Error ? err.message : 'Failed to plan this meal');
    } finally {
      setPlanIdeaSaving(false);
    }
  };

  const loading = (planQuery.isLoading && !planQuery.data) || (ideasQuery.isLoading && !ideasQuery.data);
  const loadError =
    ((planQuery.error && !planQuery.data) || (ideasQuery.error && !ideasQuery.data)) &&
    !loading;

  if (loading) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Meal week</h2>
        <div className="rounded-card border border-border p-8 text-sm text-secondary">
          Loading the meal week...
        </div>
      </div>
    );
  }

  if (loadError) {
    const message =
      planQuery.error instanceof Error
        ? planQuery.error.message
        : ideasQuery.error instanceof Error
          ? ideasQuery.error.message
          : 'Could not load the meal week.';
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Meal week</h2>
        <div role="alert" className="rounded-card border border-destructive p-4 text-sm text-destructive">
          {message}
        </div>
      </div>
    );
  }

  const today = londonDateString();
  const addDay = today >= from && today <= to ? today : from;
  const slotDialog = dialog?.kind === 'slot' ? dialog : null;
  const slotEntry = slotDialog
    ? findEntry(slotDialog.day, slotDialog.slot)
    : undefined;
  const slotIdeas = slotDialog
    ? ideasForSlot(slotDialog.day, slotDialog.slot)
    : [];
  const editDialog = dialog?.kind === 'edit' ? dialog : null;
  const planIdeaDialog = dialog?.kind === 'planIdea' ? dialog : null;
  const actionDialog = dialog?.kind === 'action' ? dialog : null;
  const shoppingDialog = dialog?.kind === 'shopping' ? dialog : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Meal week</h2>
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

      {actionError && (
        <div role="alert" className="rounded-card border border-destructive p-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {entries.length === 0 && (
        <EmptyState
          title="Nothing planned this week"
          description="Add meals to each day and the shopping list can pick up the ingredients."
          actionLabel={`Add dinner for ${shortDayLabel(addDay)}`}
          onAction={() => openSlot(addDay, 'dinner')}
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
                <SlotCell
                  key={`${day}-${slot}`}
                  day={day}
                  slot={slot}
                  entry={findEntry(day, slot)}
                  ideaCount={ideasForSlot(day, slot).length}
                  onOpen={openSlot}
                  onAdd={openSlot}
                  onToggleStatus={toggleStatus}
                  onRemove={removeEntry}
                  onShopping={openShopping}
                />
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
                <SlotCell
                  day={day}
                  slot={slot}
                  entry={findEntry(day, slot)}
                  ideaCount={ideasForSlot(day, slot).length}
                  onOpen={openSlot}
                  onAdd={openSlot}
                  onToggleStatus={toggleStatus}
                  onRemove={removeEntry}
                  onShopping={openShopping}
                />
              </div>
            ))}
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <button
          type="button"
          onClick={() => setIdeasOpen((current) => !current)}
          aria-expanded={ideasOpen}
          aria-controls="unscheduled-ideas"
          className="flex min-h-[44px] w-full items-center justify-between gap-3 text-left"
        >
          <span>
            <span className="block text-lg font-semibold tracking-tight">
              Unscheduled ideas
            </span>
            <span className="block text-sm text-secondary">
              {unscheduledIdeas.length}{' '}
              {unscheduledIdeas.length === 1 ? 'idea' : 'ideas'} with no day yet
            </span>
          </span>
          <span className="text-sm text-secondary">{ideasOpen ? 'Hide' : 'Show'}</span>
        </button>

        {ideasOpen && (
          <div id="unscheduled-ideas" className="space-y-3">
            {unscheduledIdeas.length === 0 ? (
              <p className="text-sm text-secondary">
                No unscheduled ideas. Suggest one from any meal slot above.
              </p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {unscheduledIdeas.map((idea) => (
                  <Card key={idea.id} className="flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold break-words">
                        {idea.recipe_source !== 'free_text' && idea.recipe_id ? (
                          <a
                            href={`/meals/recipes/${idea.recipe_id}?source=${idea.recipe_source}`}
                            className="underline underline-offset-4 hover:text-accent"
                          >
                            {idea.title}
                          </a>
                        ) : (
                          idea.title
                        )}
                      </h3>
                      {idea.note && (
                        <p className="mt-1 whitespace-pre-wrap text-sm text-secondary">
                          {idea.note}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-secondary">
                        Suggested by {idea.suggested_by_name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        aria-pressed={idea.voted_by_me}
                        aria-label={`Vote for ${idea.title}`}
                        onClick={() => toggleVote(idea)}
                        disabled={votingId === idea.id}
                        className={idea.voted_by_me ? 'border-accent text-accent' : undefined}
                      >
                        {idea.voted_by_me ? 'Voted' : 'Vote'} ({idea.votes})
                      </Button>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => openPlanIdea(idea)}
                        aria-label={`Plan ${idea.title}`}
                      >
                        Plan it
                      </Button>
                      {canManageIdea(idea) && (
                        <button
                          type="button"
                          onClick={() => removeIdea(idea)}
                          className="min-h-[44px] px-1 text-xs text-secondary hover:text-destructive"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <Dialog
        open={slotDialog !== null}
        onClose={closeDialog}
        title={
          slotDialog
            ? `${fullDayLabel(slotDialog.day)} · ${MEAL_SLOT_LABELS[slotDialog.slot]}`
            : 'Meal'
        }
      >
        {slotDialog && (
          <div className="space-y-5">
            {actionError && (
              <div role="alert" className="rounded-card border border-destructive p-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {slotEntry ? (
              <div className="space-y-2 rounded-card border border-border p-3">
                <div>
                  <p className="text-sm font-semibold break-words">
                    {slotEntry.recipe_source !== 'free_text' && slotEntry.recipe_id ? (
                      <Link
                        href={`/meals/recipes/${slotEntry.recipe_id}?source=${slotEntry.recipe_source}`}
                        className="underline-offset-4 hover:text-accent hover:underline"
                      >
                        {slotEntry.recipe_title}
                      </Link>
                    ) : (
                      slotEntry.recipe_title
                    )}
                  </p>
                  <p className="mt-1 text-xs text-secondary">
                    {slotEntry.servings}{' '}
                    {slotEntry.servings === 1 ? 'serving' : 'servings'}
                    {slotEntry.cook_name ? ` • ${slotEntry.cook_name}` : ''}
                  </p>
                  {slotEntry.serve_time && (
                    <p className="mt-1 text-xs text-secondary">
                      Served at {serveTimeLabel(slotEntry.serve_time)}
                    </p>
                  )}
                  <p
                    className={
                      slotEntry.status === 'cooked'
                        ? 'mt-1 text-xs font-medium text-success'
                        : 'mt-1 text-xs text-secondary'
                    }
                  >
                    {STATUS_LABELS[slotEntry.status]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {slotEntry.recipe_source !== 'free_text' && slotEntry.recipe_id ? (
                    <Link
                      href={`/meals/recipes/${slotEntry.recipe_id}?source=${slotEntry.recipe_source}`}
                      className="inline-flex min-h-[44px] items-center justify-center whitespace-nowrap rounded-btn border border-foreground bg-background px-4 py-2 text-sm font-semibold hover:bg-surface"
                    >
                      View recipe
                    </Link>
                  ) : null}
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openEdit(slotEntry)}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => toggleStatus(slotEntry)}
                  >
                    {slotEntry.status === 'cooked' ? 'Mark planned' : 'Mark cooked'}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => openShopping(slotEntry)}
                  >
                    Add to shopping
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => removeEntry(slotEntry)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-secondary">Nothing planned for this meal yet.</p>
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">
                Ideas for this {MEAL_SLOT_LABELS[slotDialog.slot].toLowerCase()} (
                {slotIdeas.length})
              </h3>
              {slotIdeas.length === 0 ? (
                <p className="text-sm text-secondary">No ideas for this meal yet.</p>
              ) : (
                <ul className="space-y-3">
                  {slotIdeas.map((idea) => (
                    <li key={idea.id} className="rounded-card border border-border p-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium break-words">
                            {idea.recipe_source !== 'free_text' && idea.recipe_id ? (
                              <Link
                                href={`/meals/recipes/${idea.recipe_id}?source=${idea.recipe_source}`}
                                className="underline-offset-4 hover:text-accent hover:underline"
                              >
                                {idea.title}
                              </Link>
                            ) : (
                              idea.title
                            )}
                          </p>
                          {idea.note && (
                            <p className="mt-1 whitespace-pre-wrap text-xs text-secondary">
                              {idea.note}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-secondary">
                            Suggested by {idea.suggested_by_name}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            aria-pressed={idea.voted_by_me}
                            aria-label={`Vote for ${idea.title}`}
                            onClick={() => toggleVote(idea)}
                            disabled={votingId === idea.id}
                            className={
                              idea.voted_by_me ? 'border-accent text-accent' : undefined
                            }
                          >
                            {idea.voted_by_me ? 'Voted' : 'Vote'} ({idea.votes})
                          </Button>
                          <Button
                            type="button"
                            aria-label={`Choose ${idea.title} for ${MEAL_SLOT_LABELS[
                              slotDialog.slot
                            ].toLowerCase()} on ${fullDayLabel(slotDialog.day)}`}
                            disabled={choosingId === idea.id}
                            onClick={() =>
                              chooseIdea(idea, slotDialog.day, slotDialog.slot)
                            }
                          >
                            {choosingId === idea.id ? 'Planning...' : 'Choose'}
                          </Button>
                          {canManageIdea(idea) && (
                            <button
                              type="button"
                              onClick={() => removeIdea(idea)}
                              className="min-h-[44px] px-1 text-xs text-secondary hover:text-destructive"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Find a recipe</h3>
              <div className="flex gap-2">
                <Input
                  id="slot_recipe_search"
                  value={recipeQuery}
                  onChange={(event) => setRecipeQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      searchRecipes();
                    }
                  }}
                  placeholder="Search recipes"
                  className="min-w-0 flex-1"
                  aria-label="Search recipes"
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
                <p role="alert" className="text-xs text-destructive">
                  {searchError}
                </p>
              )}
              {recipeResults.length > 0 && (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-card border border-border p-1">
                  {recipeResults.map((recipe) => (
                    <li key={`${recipe.source}-${recipe.id}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRecipe(recipe);
                          setRecipeResults([]);
                        }}
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
              {selectedRecipe && (
                <div className="rounded-card border border-border p-3">
                  <p className="text-sm font-medium break-words">{selectedRecipe.title}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        const target: RecipeTarget = {
                          source: selectedRecipe.source,
                          id: selectedRecipe.id,
                          title: selectedRecipe.title,
                          servings: selectedRecipe.servings,
                        };
                        setDialog({
                          kind: 'action',
                          action: 'plan',
                          recipe: target,
                          date: slotDialog.day,
                          slot: slotDialog.slot,
                        });
                      }}
                    >
                      Plan this meal
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        const target: RecipeTarget = {
                          source: selectedRecipe.source,
                          id: selectedRecipe.id,
                          title: selectedRecipe.title,
                          servings: selectedRecipe.servings,
                        };
                        setDialog({
                          kind: 'action',
                          action: 'suggest',
                          recipe: target,
                          date: slotDialog.day,
                          slot: slotDialog.slot,
                        });
                      }}
                    >
                      Suggest for this meal
                    </Button>
                  </div>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Suggest a meal</h3>
              <form
                onSubmit={(event) =>
                  submitSuggestion(event, slotDialog.day, slotDialog.slot)
                }
                className="space-y-3"
              >
                {suggestionError && (
                  <div role="alert" className="rounded-card border border-destructive p-3 text-sm text-destructive">
                    {suggestionError}
                  </div>
                )}
                <div>
                  <label
                    htmlFor="slot_suggestion_title"
                    className="mb-1 block text-sm font-medium"
                  >
                    Meal name
                  </label>
                  <Input
                    id="slot_suggestion_title"
                    required
                    value={suggestionTitle}
                    onChange={(event) => setSuggestionTitle(event.target.value)}
                    placeholder="e.g. Mushroom risotto"
                  />
                </div>
                <div>
                  <label
                    htmlFor="slot_suggestion_note"
                    className="mb-1 block text-sm font-medium"
                  >
                    Note (optional)
                  </label>
                  <textarea
                    id="slot_suggestion_note"
                    rows={2}
                    value={suggestionNote}
                    onChange={(event) => setSuggestionNote(event.target.value)}
                    placeholder="Why this meal, or anything the cook should know"
                    className="w-full rounded-card border border-border bg-background px-3 py-2 text-base"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={suggestionSaving || !suggestionTitle.trim()}
                >
                  {suggestionSaving
                    ? 'Saving...'
                    : `Suggest for this ${MEAL_SLOT_LABELS[
                        slotDialog.slot
                      ].toLowerCase()}`}
                </Button>
              </form>
            </section>

            <p className="text-sm">
              <a
                href="/meals?view=recipes"
                className="underline underline-offset-4 hover:text-accent"
              >
                Import a recipe
              </a>
            </p>
          </div>
        )}
      </Dialog>

      <Dialog
        open={editDialog !== null}
        onClose={closeDialog}
        title="Edit planned meal"
      >
        {editDialog && (
          <form onSubmit={saveEdit} className="space-y-4">
            {editError && (
              <div role="alert" className="rounded-card border border-destructive p-3 text-sm text-destructive">
                {editError}
              </div>
            )}
            <p className="text-xs text-secondary">
              {fullDayLabel(editDialog.entry.date)} ·{' '}
              {MEAL_SLOT_LABELS[editDialog.entry.slot]}
            </p>
            <div>
              <label htmlFor="edit_meal_title" className="mb-1 block text-sm font-medium">
                Meal
              </label>
              <Input
                id="edit_meal_title"
                required
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="edit_meal_servings"
                  className="mb-1 block text-sm font-medium"
                >
                  Servings
                </label>
                <Input
                  id="edit_meal_servings"
                  type="number"
                  min={1}
                  max={100}
                  value={editServings}
                  onChange={(event) =>
                    setEditServings(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="edit_meal_time"
                  className="mb-1 block text-sm font-medium"
                >
                  Serve time (optional)
                </label>
                <Input
                  id="edit_meal_time"
                  type="time"
                  value={editTime}
                  onChange={(event) => setEditTime(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="edit_meal_cook" className="mb-1 block text-sm font-medium">
                  Cook
                </label>
                <select
                  id="edit_meal_cook"
                  value={editCook}
                  onChange={(event) => setEditCook(event.target.value)}
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-base"
                >
                  <option value="">Anyone</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="edit_meal_status"
                  className="mb-1 block text-sm font-medium"
                >
                  Status
                </label>
                <select
                  id="edit_meal_status"
                  value={editStatus}
                  onChange={(event) =>
                    setEditStatus(event.target.value as MealPlanEntry['status'])
                  }
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-base"
                >
                  <option value="planned">Planned</option>
                  <option value="cooked">Cooked</option>
                  <option value="skipped">Skipped</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={editSaving}>
                {editSaving ? 'Saving...' : 'Save meal'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={planIdeaDialog !== null}
        onClose={closeDialog}
        title={planIdeaDialog ? `Plan ${planIdeaDialog.idea.title}` : 'Plan meal'}
      >
        {planIdeaDialog && (
          <form onSubmit={savePlanIdea} className="space-y-4">
            {planIdeaError && (
              <div role="alert" className="rounded-card border border-destructive p-3 text-sm text-destructive">
                {planIdeaError}
              </div>
            )}
            <p className="text-sm">
              {planIdeaDialog.idea.title}
              <span className="text-secondary">
                {' '}
                · suggested by {planIdeaDialog.idea.suggested_by_name}
              </span>
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="plan_idea_date" className="mb-1 block text-sm font-medium">
                  Day
                </label>
                <Input
                  id="plan_idea_date"
                  type="date"
                  required
                  value={planIdeaDate}
                  onChange={(event) => setPlanIdeaDate(event.target.value)}
                />
              </div>
              <div>
                <label htmlFor="plan_idea_slot" className="mb-1 block text-sm font-medium">
                  Meal
                </label>
                <select
                  id="plan_idea_slot"
                  value={planIdeaSlot}
                  onChange={(event) => setPlanIdeaSlot(event.target.value as MealSlot)}
                  className="h-11 w-full rounded-card border border-border bg-background px-3 text-base"
                >
                  {MEAL_SLOTS.map((slot) => (
                    <option key={slot} value={slot}>
                      {MEAL_SLOT_LABELS[slot]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="plan_idea_servings"
                  className="mb-1 block text-sm font-medium"
                >
                  Servings
                </label>
                <Input
                  id="plan_idea_servings"
                  type="number"
                  min={1}
                  max={100}
                  value={planIdeaServings}
                  onChange={(event) =>
                    setPlanIdeaServings(Math.max(1, Number(event.target.value) || 1))
                  }
                />
              </div>
              <div>
                <label
                  htmlFor="plan_idea_time"
                  className="mb-1 block text-sm font-medium"
                >
                  Serve time (optional)
                </label>
                <Input
                  id="plan_idea_time"
                  type="time"
                  value={planIdeaTime}
                  onChange={(event) => setPlanIdeaTime(event.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="plan_idea_cook" className="mb-1 block text-sm font-medium">
                Cook (optional)
              </label>
              <select
                id="plan_idea_cook"
                value={planIdeaCook}
                onChange={(event) => setPlanIdeaCook(event.target.value)}
                className="h-11 w-full rounded-card border border-border bg-background px-3 text-base"
              >
                <option value="">Anyone</option>
                {members.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-secondary">
              This replaces any meal already planned for that slot.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={planIdeaSaving}>
                {planIdeaSaving ? 'Saving...' : 'Plan meal'}
              </Button>
            </div>
          </form>
        )}
      </Dialog>

      <MealActionDialog
        open={actionDialog !== null}
        action={actionDialog?.action ?? 'plan'}
        recipe={actionDialog?.recipe ?? null}
        defaultDate={actionDialog?.date ?? null}
        defaultSlot={actionDialog?.slot ?? null}
        onClose={closeDialog}
        onDone={closeDialog}
      />

      <AddToShoppingDialog
        open={shoppingDialog !== null}
        target={
          shoppingDialog ? { kind: 'plan', entry: shoppingDialog.entry } : null
        }
        onClose={closeDialog}
        onAdded={invalidatePlan}
      />
    </div>
  );
}
