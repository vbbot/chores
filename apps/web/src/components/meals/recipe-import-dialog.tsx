'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { Recipe } from '@/lib/types';

interface RecipeImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported?: (recipe: Recipe) => void;
}

export function RecipeImportDialog({ open, onClose, onImported }: RecipeImportDialogProps) {
  const queryClient = useQueryClient();
  const [url, setUrl] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [imported, setImported] = React.useState<Recipe | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setUrl('');
    setError(null);
    setSubmitting(false);
    setImported(null);
  }, [open]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const recipe = await apiFetch<Recipe>('/api/v1/recipes/import', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim() }),
      });
      await queryClient.invalidateQueries({ queryKey: ['meals', 'recipes'] });
      setImported(recipe);
      onImported?.(recipe);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not import this recipe.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} title="Import a recipe">
      {imported ? (
        <div className="space-y-4">
          <div className="rounded-card border border-border p-3">
            <p className="text-sm font-semibold">{imported.title}</p>
            <p className="mt-1 text-xs text-secondary">
              {[
                imported.total_minutes != null ? `${imported.total_minutes} min` : null,
                `Serves ${imported.servings}`,
                imported.source === 'household' ? 'Household recipe' : 'Catalogue recipe',
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>

          <p className="text-sm text-secondary">
            The recipe is saved to your household. You can add it to a meal plan from the
            meals page.
          </p>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Link
              href={`/meals/recipes/${imported.id}?source=${imported.source}`}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-btn border border-foreground bg-foreground px-4 py-2 text-sm font-semibold text-background min-h-[44px] hover:opacity-90"
            >
              Open recipe
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-secondary">
            Paste a link to a recipe page. Only pages that contain schema.org recipe data
            can be imported, and only links starting with http:// or https:// work.
          </p>

          {error && (
            <div
              role="alert"
              className="p-3 text-sm rounded-card border border-destructive text-destructive"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="recipe_import_url" className="block text-sm font-medium mb-1">
              Recipe page URL
            </label>
            <Input
              id="recipe_import_url"
              type="url"
              required
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/recipe"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !url.trim()}>
              {submitting ? 'Importing...' : 'Import recipe'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
