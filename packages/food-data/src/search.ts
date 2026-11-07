import type { Recipe, RecipeIngredient } from '@chores/domain';

import { getRecipeDb } from './db';

const STOPWORDS = new Set([
  'the',
  'and',
  'with',
  'for',
  'from',
  'into',
  'that',
  'this',
  'recipe',
  'recipes',
]);

export function searchTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2 && !STOPWORDS.has(token))
    .slice(0, 8);
}

function matchExpression(tokens: string[], operator: 'AND' | 'OR'): string {
  return tokens.map((token) => `${token}*`).join(` ${operator} `);
}

interface RecipeRow {
  id: string;
  source: string;
  title: string;
  servings: number;
  prep_minutes: number | null;
  cook_minutes: number | null;
  total_minutes: number | null;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  license: string | null;
  instructions: string;
  tags: string;
  nutrition_json: string | null;
}

function ingredientsFor(recipeId: string): RecipeIngredient[] {
  const db = getRecipeDb();
  if (!db) return [];
  const rows = db
    .prepare(
      `SELECT raw, name, quantity, unit
       FROM recipe_ingredients
       WHERE recipe_id = ?
       ORDER BY position ASC`
    )
    .all(recipeId) as RecipeIngredient[];
  return rows;
}

function mapRecipe(row: RecipeRow): Recipe {
  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags) as string[];
  } catch {
    tags = [];
  }
  let nutrition: Recipe['nutrition'] = null;
  if (row.nutrition_json) {
    try {
      nutrition = JSON.parse(row.nutrition_json) as Recipe['nutrition'];
    } catch {
      nutrition = null;
    }
  }
  return {
    id: row.id,
    source: 'catalogue',
    title: row.title,
    servings: row.servings,
    prep_minutes: row.prep_minutes,
    cook_minutes: row.cook_minutes,
    total_minutes: row.total_minutes,
    image_url: row.image_url,
    source_url: row.source_url,
    source_name: row.source_name,
    license: row.license,
    ingredients: ingredientsFor(row.id),
    steps: row.instructions
      ? row.instructions.split('\n').map((step) => step.trim()).filter(Boolean)
      : [],
    tags,
    nutrition,
  };
}

export interface CatalogueSearchOptions {
  maxTime?: number;
  page?: number;
  limit?: number;
}

export function searchCatalogueRecipes(
  query: string,
  options: CatalogueSearchOptions = {}
): Recipe[] {
  const db = getRecipeDb();
  if (!db) return [];
  const tokens = searchTokens(query);
  if (tokens.length === 0) return [];

  const limit = Math.min(Math.max(options.limit ?? 30, 1), 50);
  const offset = (Math.max(options.page ?? 1, 1) - 1) * limit;
  const maxTime = options.maxTime ?? null;

  const run = (operator: 'AND' | 'OR') => {
    const match = matchExpression(tokens, operator);
    return db
      .prepare(
        `SELECT r.id, r.source, r.title, r.servings, r.prep_minutes,
                r.cook_minutes, r.total_minutes, r.image_url, r.source_url,
                r.source_name, r.license, r.instructions, r.tags,
                r.nutrition_json
         FROM recipe_search
         JOIN recipes r ON r.id = recipe_search.recipe_id
         WHERE recipe_search MATCH ?
           AND (? IS NULL OR r.total_minutes <= ?)
         ORDER BY bm25(recipe_search, 8.0, 1.0)
         LIMIT ? OFFSET ?`
      )
      .all(match, maxTime, maxTime, limit, offset) as RecipeRow[];
  };

  let rows = run('AND');
  if (rows.length === 0 && tokens.length > 1) rows = run('OR');
  return rows.map(mapRecipe);
}

export function getCatalogueRecipe(id: string): Recipe | null {
  const db = getRecipeDb();
  if (!db) return null;
  const row = db
    .prepare(
      `SELECT id, source, title, servings, prep_minutes, cook_minutes,
              total_minutes, image_url, source_url, source_name, license,
              instructions, tags, nutrition_json
       FROM recipes WHERE id = ?`
    )
    .get(id) as RecipeRow | undefined;
  return row ? mapRecipe(row) : null;
}
