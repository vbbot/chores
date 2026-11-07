'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-provider';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { MealIdea, Recipe } from '@/lib/types';

export default function MealIdeas() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useApiQuery<MealIdea[]>(
    queryKeys.meals.ideas,
    '/api/v1/meals/ideas'
  );
  const ideas = data ?? [];
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const [note, setNote] = React.useState('');
  const [recipeSource, setRecipeSource] =
    React.useState<MealIdea['recipe_source']>('free_text');
  const [recipeId, setRecipeId] = React.useState<string | null>(null);
  const [recipeQuery, setRecipeQuery] = React.useState('');
  const [recipeResults, setRecipeResults] = React.useState<Recipe[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [searchError, setSearchError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const openDialog = () => {
    setTitle('');
    setNote('');
    setRecipeSource('free_text');
    setRecipeId(null);
    setRecipeQuery('');
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

  const submitIdea = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setFormError(null);
    try {
      await apiFetch('/api/v1/meals/ideas', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          recipe_source: recipeSource,
          recipe_id: recipeSource === 'free_text' ? null : recipeId,
          note: note.trim() || null,
        }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.ideas });
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Failed to suggest this meal');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleVote = async (idea: MealIdea) => {
    setActionError(null);
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
      await apiFetch(`/api/v1/meals/ideas/${idea.id}/vote`, { method: 'POST' });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to save your vote');
    } finally {
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.ideas });
    }
  };

  const removeIdea = async (idea: MealIdea) => {
    if (!(await confirm('Remove this meal idea?'))) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/meals/ideas/${idea.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.meals.ideas });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove this meal idea');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Meal ideas</h2>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading meal ideas...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Meal ideas</h2>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load meal ideas.'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Meal ideas</h2>
          <p className="text-sm text-secondary">
            Suggest meals your household might enjoy, then vote for favourites.
          </p>
        </div>
        <Button onClick={openDialog}>Suggest a meal</Button>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Could not load meal ideas.')}
        </div>
      )}

      {ideas.length === 0 ? (
        <EmptyState
          title="No meal ideas yet"
          description="Suggest a meal and let the household vote on what to cook."
          actionLabel="Suggest a meal"
          onAction={openDialog}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ideas.map((idea) => (
            <Card key={idea.id} className="flex flex-col justify-between gap-3">
              <div>
                <h3 className="font-semibold text-base break-words">
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
                  <p className="mt-1 text-sm text-secondary whitespace-pre-wrap">{idea.note}</p>
                )}
                <p className="mt-2 text-xs text-secondary">
                  Suggested by {idea.suggested_by_name}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  aria-pressed={idea.voted_by_me}
                  aria-label={`Vote for ${idea.title}`}
                  onClick={() => toggleVote(idea)}
                  className={idea.voted_by_me ? 'border-accent text-accent' : undefined}
                >
                  {idea.voted_by_me ? 'Voted' : 'Vote'} ({idea.votes})
                </Button>
                <button
                  type="button"
                  onClick={() => removeIdea(idea)}
                  className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Suggest a meal">
        <form onSubmit={submitIdea} className="space-y-4">
          {formError && (
            <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
              {formError}
            </div>
          )}
          <div>
            <label htmlFor="idea_title" className="block text-sm font-medium mb-1">
              Meal name
            </label>
            <Input
              id="idea_title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Mushroom risotto"
            />
          </div>
          <div>
            <label htmlFor="idea_recipe" className="block text-sm font-medium mb-1">
              Find a recipe (optional)
            </label>
            <div className="flex gap-2">
              <Input
                id="idea_recipe"
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
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {recipeId ? (
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-secondary">
                <span>Linked to a {recipeSource === 'household' ? 'household' : 'catalogue'} recipe.</span>
                <button
                  type="button"
                  onClick={() => {
                    setRecipeSource('free_text');
                    setRecipeId(null);
                  }}
                  className="min-h-[44px] px-1 text-secondary hover:text-foreground"
                >
                  Use free text
                </button>
              </div>
            ) : (
              <p className="mt-2 text-xs text-secondary">
                No recipe linked. The idea is saved as free text.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="idea_note" className="block text-sm font-medium mb-1">
              Note (optional)
            </label>
            <textarea
              id="idea_note"
              rows={3}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Why this meal, or anything the cook should know"
              className="w-full px-3 py-2 border border-border rounded-card bg-background text-base"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Add idea'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
