'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useConfirm } from '@/components/ui/confirm-provider';
import { EmptyState } from '@/components/ui/empty-state';
import { apiFetch } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { Recipe, RecipeNutrition } from '@/lib/types';
import { AddToShoppingDialog, ShoppingTarget } from '@/components/meals/add-to-shopping-dialog';
import {
  MealAction,
  MealActionDialog,
  RecipeTarget,
} from '@/components/meals/meal-action-dialog';

const CONFIDENCE_LABELS: Record<RecipeNutrition['confidence'], string> = {
  matched: 'Matched',
  estimated: 'Estimated',
  partial: 'Partial',
  unavailable: 'Unavailable',
};

function metaLine(recipe: Recipe): string {
  const total =
    recipe.total_minutes != null
      ? `${recipe.total_minutes} min`
      : recipe.prep_minutes != null || recipe.cook_minutes != null
        ? `${(recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0)} min`
        : null;

  return [total, `Serves ${recipe.servings}`].filter(Boolean).join(' · ');
}

function NutritionRow({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-border py-1 last:border-b-0">
      <span className="text-sm text-secondary">{label}</span>
      <span className="text-sm font-semibold">{value != null ? value : '—'}</span>
    </div>
  );
}

function RecipeView({ id }: { id: string }) {
  const router = useRouter();
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const sourceParam = searchParams.get('source');
  const source = sourceParam === 'household' ? 'household' : 'catalogue';

  const { data: recipe, isLoading, error } = useApiQuery<Recipe>(
    queryKeys.meals.recipe(source, id),
    `/api/v1/recipes/${id}?source=${source}`
  );

  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [action, setAction] = React.useState<{ kind: MealAction; target: RecipeTarget } | null>(
    null
  );
  const [shoppingTarget, setShoppingTarget] = React.useState<ShoppingTarget | null>(null);

  const notFound =
    !isLoading &&
    !recipe &&
    error != null &&
    (error as { status?: number }).status === 404;

  const handleDelete = async () => {
    if (!recipe) return;
    if (!(await confirm('Delete this recipe? This cannot be undone.'))) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await apiFetch(`/api/v1/recipes/${recipe.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: ['meals', 'recipes'] });
      router.push('/meals?view=recipes');
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete this recipe.');
    } finally {
      setDeleting(false);
    }
  };

  const backLink = (
    <Link
      href="/meals?view=recipes"
      className="inline-flex items-center text-sm text-secondary hover:text-foreground min-h-[44px]"
    >
      Back to recipes
    </Link>
  );

  if (isLoading && !recipe) {
    return (
      <div className="space-y-4">
        {backLink}
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading recipe...
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        {backLink}
        <EmptyState
          title="Recipe not found"
          description="This recipe may have been deleted, or the link points at a different source."
        />
      </div>
    );
  }

  if (error || !recipe) {
    return (
      <div className="space-y-4">
        {backLink}
        <div
          role="alert"
          className="p-4 border border-destructive text-destructive rounded-card text-sm"
        >
          {error instanceof Error ? error.message : 'Could not load this recipe.'}
        </div>
      </div>
    );
  }

  const nutrition = recipe.nutrition;
  const target: RecipeTarget = {
    source: recipe.source,
    id: recipe.id,
    title: recipe.title,
    servings: recipe.servings,
  };

  return (
    <div className="space-y-6">
      <div>{backLink}</div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">{recipe.title}</h1>
          <p className="text-sm text-secondary">{metaLine(recipe)}</p>
          <p className="text-xs text-secondary">
            {recipe.source_name ? (
              recipe.source_url ? (
                <a
                  href={recipe.source_url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline hover:text-foreground"
                >
                  {recipe.source_name}
                </a>
              ) : (
                recipe.source_name
              )
            ) : recipe.source === 'household' ? (
              'Household recipe'
            ) : (
              'Catalogue recipe'
            )}
            {recipe.license ? ` · ${recipe.license}` : ''}
          </p>
        </div>

        {recipe.source === 'household' && (
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete recipe'}
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 rounded-card border border-border p-3">
        <Button
          type="button"
          onClick={() => setAction({ kind: 'plan', target })}
          aria-label={`Plan ${recipe.title}`}
        >
          Plan meal
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setAction({ kind: 'suggest', target })}
          aria-label={`Suggest ${recipe.title}`}
        >
          Suggest
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShoppingTarget({ kind: 'recipe', ...target })}
          aria-label={`Add ingredients for ${recipe.title} to shopping`}
        >
          Add ingredients
        </Button>
      </div>

      {deleteError && (
        <div
          role="alert"
          className="p-3 text-sm rounded-card border border-destructive text-destructive"
        >
          {deleteError}
        </div>
      )}

      {recipe.image_url && (
        <img
          src={recipe.image_url}
          alt={recipe.title}
          className="w-full max-h-80 rounded-card border border-border object-cover"
        />
      )}

      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-card border border-border px-2 py-0.5 text-xs font-semibold text-secondary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <section className="space-y-2">
            <h2 className="text-sm font-semibold border-b border-border pb-2">Ingredients</h2>
            <ul className="space-y-1">
              {recipe.ingredients.map((ingredient, index) => {
                const amount = [
                  ingredient.quantity != null ? String(ingredient.quantity) : null,
                  ingredient.unit,
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <li key={`${ingredient.name}-${index}`} className="text-sm">
                    {amount ? `${amount} ${ingredient.name}` : ingredient.name}
                  </li>
                );
              })}
            </ul>
          </section>

          {recipe.steps.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold border-b border-border pb-2">Method</h2>
              <ol className="list-decimal space-y-2 pl-5">
                {recipe.steps.map((step, index) => (
                  <li key={index} className="text-sm">
                    {step}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        <Card className="h-fit space-y-3">
          <h2 className="text-sm font-semibold border-b border-border pb-2">Nutrition</h2>
          {nutrition ? (
            <>
              <p className="text-xs text-secondary">
                {CONFIDENCE_LABELS[nutrition.confidence]} · matched{' '}
                {nutrition.matched_ingredients} of {nutrition.total_ingredients} ingredients
              </p>
              <div>
                <NutritionRow label="Calories" value={nutrition.calories} />
                <NutritionRow label="Protein (g)" value={nutrition.protein_g} />
                <NutritionRow label="Carbs (g)" value={nutrition.carbs_g} />
                <NutritionRow label="Fat (g)" value={nutrition.fat_g} />
                <NutritionRow label="Fibre (g)" value={nutrition.fibre_g} />
                <NutritionRow label="Sugar (g)" value={nutrition.sugar_g} />
                <NutritionRow label="Salt (g)" value={nutrition.salt_g} />
              </div>
              {nutrition.source && (
                <p className="text-xs text-secondary">Source: {nutrition.source}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-secondary">Nutrition unavailable</p>
          )}
        </Card>
      </div>

      <MealActionDialog
        open={action !== null}
        action={action?.kind ?? 'plan'}
        recipe={action?.target ?? null}
        onClose={() => setAction(null)}
      />

      <AddToShoppingDialog
        open={shoppingTarget !== null}
        target={shoppingTarget}
        onClose={() => setShoppingTarget(null)}
      />
    </div>
  );
}

export default function RecipePage({ params }: { params: { id: string } }) {
  return (
    <React.Suspense
      fallback={
        <div className="space-y-4">
          <div className="p-8 text-sm text-secondary border border-border rounded-card">
            Loading recipe...
          </div>
        </div>
      }
    >
      <RecipeView id={params.id} />
    </React.Suspense>
  );
}
