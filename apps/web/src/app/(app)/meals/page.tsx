'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import MealWeek from '@/components/meals/meal-week';
import RecipeBrowser from '@/components/meals/recipe-browser';
import { cn } from '@/lib/utils';

const VIEWS = [
  { id: 'week', label: 'This week' },
  { id: 'recipes', label: 'Recipes' },
] as const;

type View = (typeof VIEWS)[number]['id'];

function MealsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get('view');
  const view: View = requested === 'recipes' ? 'recipes' : 'week';
  const openIdeas = requested === 'ideas';

  const setView = (next: View) => {
    router.replace(`/meals?view=${next}`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Meals</h1>
        <p className="text-sm text-secondary">
          Plan the week together, then turn recipes into shopping.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Meals sections"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {VIEWS.map((item) => {
          const active = item.id === view;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(item.id)}
              className={cn(
                'inline-flex min-h-[44px] items-center whitespace-nowrap border-b-2 px-4 text-sm transition-colors',
                active
                  ? 'border-accent font-semibold text-foreground'
                  : 'border-transparent text-secondary hover:text-foreground'
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel">
        {view === 'week' && <MealWeek openIdeasInitially={openIdeas} />}
        {view === 'recipes' && <RecipeBrowser />}
      </div>
    </div>
  );
}

export default function MealsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading meals...
        </div>
      }
    >
      <MealsContent />
    </React.Suspense>
  );
}
