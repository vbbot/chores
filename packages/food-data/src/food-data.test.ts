import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getRecipeDb, openWritableRecipeDb, resetRecipeDbCache } from './db';
import { importFoodComCsv } from './import';
import { estimateNutrition } from './nutrition';
import { searchCatalogueRecipes, searchTokens } from './search';

let dir: string;
let dbPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'chores-food-'));
  dbPath = join(dir, 'recipes.db');
  process.env.RECIPE_DB_PATH = dbPath;
  resetRecipeDbCache();
});

afterEach(() => {
  resetRecipeDbCache();
  delete process.env.RECIPE_DB_PATH;
  rmSync(dir, { recursive: true, force: true });
});

describe('recipe search', () => {
  it('normalises query tokens', () => {
    expect(searchTokens('  Chicken, curry and rice! ')).toEqual([
      'chicken',
      'curry',
      'rice',
    ]);
  });

  it('searches titles and ingredients with prefix matching', async () => {
    const csv = join(dir, 'recipes.csv');
    writeFileSync(
      csv,
      [
        'RecipeId,Name,RecipeIngredientParts,RecipeInstructions,RecipeServings,Calories,ProteinContent,CarbohydrateContent,FatContent',
        '1,Chicken Curry,"c(""2 chicken breasts"",""1 onion"",""200 g rice"")","c(""Cook it"")",4,520,32,45,18',
        '2,Mushroom Pasta,"c(""200 g pasta"",""100 g mushrooms"")","c(""Boil and fry"")",2,430,14,60,12',
      ].join('\n')
    );
    const result = await importFoodComCsv({ csvPath: csv, dbPath, batchSize: 10 });
    expect(result.imported).toBe(2);

    const hits = searchCatalogueRecipes('chick');
    expect(hits.map((recipe) => recipe.title)).toEqual(['Chicken Curry']);
    expect(hits[0].ingredients.some((item) => item.name.includes('rice'))).toBe(true);
    expect(hits[0].nutrition?.calories).toBe(520);

    const ingredientHits = searchCatalogueRecipes('mushroom');
    expect(ingredientHits.map((recipe) => recipe.title)).toEqual(['Mushroom Pasta']);
  });

  it('does not switch a read-only catalogue into WAL mode', () => {
    const writable = openWritableRecipeDb(dbPath);
    writable.pragma('journal_mode = DELETE');
    writable.close();
    resetRecipeDbCache();
    const readonly = getRecipeDb();
    expect(readonly).not.toBeNull();
    expect(readonly!.pragma('journal_mode', { simple: true })).toBe('delete');
  });

  it('returns nothing when no database is present', () => {
    resetRecipeDbCache();
    rmSync(dbPath, { force: true });
    expect(searchCatalogueRecipes('chicken')).toEqual([]);
  });
});

describe('nutrition estimation', () => {
  it('scales matched ingredients by servings', () => {
    const nutrition = estimateNutrition(
      ['200 g chicken breast', '100 g rice', '1 onion'],
      2
    );
    expect(nutrition.calories).toBeGreaterThan(0);
    expect(nutrition.protein_g).toBeGreaterThan(0);
    expect(nutrition.matched_ingredients).toBe(3);
    expect(nutrition.total_ingredients).toBe(3);
    expect(nutrition.confidence).toBe('matched');
  });

  it('marks unmatched ingredients as partial', () => {
    const nutrition = estimateNutrition(
      ['200 g chicken breast', '1 tbsp unicorn dust'],
      2
    );
    expect(nutrition.confidence).toBe('partial');
    expect(nutrition.matched_ingredients).toBe(1);
  });
});
