'use client';

import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Recipe } from '@/lib/types';
import { RecipeImportDialog } from './recipe-import-dialog';

const TIME_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Any time' },
  { value: '15', label: 'Up to 15 min' },
  { value: '30', label: 'Up to 30 min' },
  { value: '45', label: 'Up to 45 min' },
  { value: '60', label: 'Up to 60 min' },
];

function timeLabel(recipe: Recipe): string | null {
  if (recipe.total_minutes != null) return `${recipe.total_minutes} min`;
  if (recipe.prep_minutes != null || recipe.cook_minutes != null) {
    const prep = recipe.prep_minutes ?? 0;
    const cook = recipe.cook_minutes ?? 0;
    return `${prep + cook} min`;
  }
  return null;
}

export default function RecipeBrowser() {
  const [term, setTerm] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [maxTime, setMaxTime] = React.useState('');
  const [importOpen, setImportOpen] = React.useState(false);

  const params = new URLSearchParams();
  if (query) params.set('q', query);
  if (maxTime) params.set('max_time', maxTime);
  const endpoint = `/api/v1/recipes?${params.toString()}`;

  const { data, isLoading, error } = useApiQuery<{ items: Recipe[] }>(
    queryKeys.meals.recipes(`${query}|${maxTime}`),
    endpoint,
    { enabled: query.length >= 2 }
  );

  const recipes = data?.items ?? [];
  const hasQuery = query.length >= 2;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setQuery(term.trim());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Recipes</h1>
          <p className="text-sm text-secondary">
            Search the local catalogue, or import a recipe from a web page.
          </p>
        </div>
        <Button onClick={() => setImportOpen(true)}>Import recipe</Button>
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="flex flex-wrap gap-2">
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search recipes by name or ingredient"
            aria-label="Search recipes"
            className="flex-1 min-w-[12rem]"
          />
          <select
            value={maxTime}
            onChange={(event) => setMaxTime(event.target.value)}
            aria-label="Maximum cooking time"
            className="h-11 rounded-card border border-border bg-background px-3 text-base"
          >
            {TIME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={!term.trim()}>
            Search
          </Button>
        </form>
        <p className="mt-2 text-xs text-secondary">
          Results come from the recipe catalogue stored on this server. Type at least two
          characters to search.
        </p>
      </Card>

      {error && (
        <div
          role="alert"
          className="p-3 text-sm rounded-card border border-destructive text-destructive"
        >
          {error instanceof Error ? error.message : 'Could not search recipes.'}
        </div>
      )}

      {isLoading && hasQuery && (
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Searching the recipe catalogue...
        </div>
      )}

      {!hasQuery && (
        <EmptyState
          title="Find a recipe"
          description="Search the local catalogue by recipe name or ingredient. You can also import a recipe from a web page."
        />
      )}

      {hasQuery && !isLoading && !error && recipes.length === 0 && (
        <EmptyState
          title="No recipes match"
          description="Try a shorter search, a different ingredient, or allow more cooking time."
        />
      )}

      {hasQuery && recipes.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {recipes.map((recipe) => {
            const time = timeLabel(recipe);
            const calories = recipe.nutrition?.calories;
            const preview = recipe.ingredients.slice(0, 3);

            return (
              <Link
                key={`${recipe.source}-${recipe.id}`}
                href={`/meals/recipes/${recipe.id}?source=${recipe.source}`}
                className="block"
              >
                <Card className="h-full transition-colors hover:bg-surface">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold leading-snug">{recipe.title}</h2>
                    <span className="shrink-0 rounded-card border border-border px-2 py-0.5 text-xs font-semibold text-secondary">
                      {recipe.source === 'household' ? 'Household' : 'Catalogue'}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-secondary">
                    {[time, `Serves ${recipe.servings}`, calories != null ? `${Math.round(calories)} kcal` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {preview.length > 0 && (
                    <p className="mt-2 text-sm text-secondary">
                      {preview.map((ingredient) => ingredient.name).join(', ')}
                      {recipe.ingredients.length > preview.length ? ' and more' : ''}
                    </p>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}

      <RecipeImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
