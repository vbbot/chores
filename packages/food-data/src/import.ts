import { createReadStream } from 'node:fs';

import type { RecipeNutrition } from '@chores/domain';
import { parse } from 'csv-parse';

import { openWritableRecipeDb } from './db';
import { estimateNutrition } from './nutrition';
import { parseIngredients } from './parse';

type CsvRow = Record<string, string>;

function normaliseHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pick(row: CsvRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[normaliseHeader(name)];
    if (value !== undefined) return value;
  }
  return '';
}

function parseList(value: string): string[] {
  if (!value) return [];
  const text = value.trim();
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).map((part) => part.trim()).filter(Boolean);
    } catch {
      // Fall through to the pipe format.
    }
  }
  if (!text.startsWith('c(')) {
    return text
      .split('|')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const matches = text.match(/"((?:[^"\\]|\\.)*)"/g) ?? [];
  return matches
    .map((match) => match.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\'))
    .map((part) => part.trim())
    .filter(Boolean);
}

function numberValue(value: string): number | null {
  const cleaned = value.replace(/[^0-9.\-]/g, '');
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function nutritionFromRow(row: CsvRow): RecipeNutrition | null {
  const calories = numberValue(pick(row, 'Calories'));
  if (calories === null) return null;
  const sodium = numberValue(pick(row, 'SodiumContent'));
  return {
    calories: Math.round(calories),
    protein_g: numberValue(pick(row, 'ProteinContent')),
    carbs_g: numberValue(pick(row, 'CarbohydrateContent')),
    fat_g: numberValue(pick(row, 'FatContent')),
    fibre_g: numberValue(pick(row, 'FiberContent')),
    sugar_g: numberValue(pick(row, 'SugarContent')),
    salt_g: sodium === null ? null : Math.round((sodium * 2.5) / 10) / 100,
    source: 'Food.com',
    confidence: 'estimated',
    matched_ingredients: 0,
    total_ingredients: 0,
  };
}

export interface ImportOptions {
  csvPath: string;
  dbPath?: string;
  limit?: number;
  batchSize?: number;
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function importFoodComCsv(options: ImportOptions): Promise<ImportResult> {
  const db = openWritableRecipeDb(options.dbPath);
  const insertRecipe = db.prepare(
    `INSERT OR REPLACE INTO recipes
      (id, source, source_id, title, servings, prep_minutes, cook_minutes,
       total_minutes, image_url, source_url, source_name, license,
       instructions, tags, nutrition_json, created_at)
     VALUES (?, 'catalogue', ?, ?, ?, ?, ?, ?, ?, ?, 'Food.com', 'CC0',
             ?, '[]', ?, ?)`
  );
  const insertIngredient = db.prepare(
    `INSERT OR REPLACE INTO recipe_ingredients
      (recipe_id, position, raw, name, name_normalized, quantity, unit)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  const insertSearch = db.prepare(
    `INSERT INTO recipe_search (recipe_id, title, ingredients) VALUES (?, ?, ?)`
  );

  db.exec('DELETE FROM recipe_search; DELETE FROM recipe_ingredients; DELETE FROM recipes;');

  let imported = 0;
  let skipped = 0;
  let batch: CsvRow[] = [];
  const batchSize = options.batchSize ?? 500;

  const flush = db.transaction((rows: CsvRow[]) => {
    for (const row of rows) {
      const title = pick(row, 'Name', 'Title').trim();
      const sourceId = pick(row, 'RecipeId', 'Id').trim();
      if (!title) {
        skipped += 1;
        continue;
      }
      const rawIngredients = parseList(
        pick(row, 'RecipeIngredientParts', 'Ingredients')
      );
      if (rawIngredients.length === 0) {
        skipped += 1;
        continue;
      }
      const id = sourceId ? `foodcom:${sourceId}` : `foodcom:${title.toLowerCase().replace(/\s+/g, '-')}`;
      const servings = numberValue(pick(row, 'RecipeServings', 'Servings')) ?? 4;
      const prep = numberValue(pick(row, 'PrepTime'));
      const cook = numberValue(pick(row, 'CookTime'));
      const total = numberValue(pick(row, 'TotalTime'));
      const steps = parseList(pick(row, 'RecipeInstructions', 'Instructions'));
      const images = parseList(pick(row, 'Images', 'Image'));
      const ingredients = parseIngredients(rawIngredients);
      const nutrition =
        nutritionFromRow(row) ??
        estimateNutrition(rawIngredients, servings);

      insertRecipe.run(
        id,
        sourceId || null,
        title,
        Math.max(1, Math.round(servings)),
        prep === null ? null : Math.round(prep),
        cook === null ? null : Math.round(cook),
        total === null ? null : Math.round(total),
        images[0] ?? null,
        null,
        steps.join('\n'),
        nutrition ? JSON.stringify(nutrition) : null,
        new Date().toISOString()
      );
      db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(id);
      ingredients.forEach((ingredient, index) => {
        insertIngredient.run(
          id,
          index,
          ingredient.raw,
          ingredient.name,
          ingredient.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(),
          ingredient.quantity,
          ingredient.unit
        );
      });
      insertSearch.run(
        id,
        title,
        ingredients
          .map((ingredient) => ingredient.name)
          .join(' ')
      );
      imported += 1;
    }
  });

  await new Promise<void>((resolve, reject) => {
    const parser = createReadStream(options.csvPath).pipe(
      parse({
        columns: (headers: string[]) =>
          headers.map((header) => normaliseHeader(header)),
        skip_empty_lines: true,
        relax_quotes: true,
        relax_column_count: true,
      })
    );

    parser.on('data', (row: CsvRow) => {
      batch.push(row);
      if (batch.length >= batchSize) {
        flush(batch);
        batch = [];
      }
      if (options.limit && imported + batch.length >= options.limit) {
        parser.destroy();
        resolve();
      }
    });
    parser.on('error', reject);
    parser.on('end', resolve);
  });

  if (batch.length > 0) flush(batch);
  db.exec(`INSERT INTO recipe_search(recipe_search) VALUES('optimize')`);
  db.pragma('journal_mode = DELETE');
  db.prepare(
    `INSERT INTO metadata (key, value) VALUES ('imported_at', ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(new Date().toISOString());
  db.close();
  return { imported, skipped };
}

export function importFoods(
  db: ReturnType<typeof openWritableRecipeDb>,
  foods: {
    fdcId: number;
    description: string;
    dataType?: string | null;
    nutrients: unknown;
    portions?: unknown;
  }[]
): number {
  const statement = db.prepare(
    `INSERT OR REPLACE INTO foods
      (fdc_id, description, data_type, nutrients_json, portions_json)
     VALUES (?, ?, ?, ?, ?)`
  );
  const insert = db.transaction((items: typeof foods) => {
    for (const food of items) {
      statement.run(
        food.fdcId,
        food.description,
        food.dataType ?? null,
        JSON.stringify(food.nutrients),
        food.portions ? JSON.stringify(food.portions) : null
      );
    }
  });
  insert(foods);
  return foods.length;
}
