import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

import Database from 'better-sqlite3';

let cached: Database.Database | null | undefined;

export function recipeDbPath(): string {
  return process.env.RECIPE_DB_PATH || join(process.cwd(), 'data', 'recipes.db');
}

export function getRecipeDb(): Database.Database | null {
  if (cached !== undefined) return cached;
  const path = recipeDbPath();
  if (!existsSync(path)) {
    cached = null;
    return null;
  }
  try {
    const db = new Database(path, { readonly: true, fileMustExist: true });
    db.pragma('query_only = ON');
    db.pragma('mmap_size = 268435456');
    db.pragma('cache_size = -64000');
    cached = db;
    return db;
  } catch {
    cached = null;
    return null;
  }
}

export function openWritableRecipeDb(path = recipeDbPath()): Database.Database {
  mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.exec(SCHEMA);
  cached = undefined;
  return db;
}

export function resetRecipeDbCache(): void {
  if (cached) cached.close();
  cached = undefined;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  source_id TEXT,
  title TEXT NOT NULL,
  servings INTEGER NOT NULL DEFAULT 4,
  prep_minutes INTEGER,
  cook_minutes INTEGER,
  total_minutes INTEGER,
  image_url TEXT,
  source_url TEXT,
  source_name TEXT,
  license TEXT,
  instructions TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  nutrition_json TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  recipe_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  raw TEXT NOT NULL,
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,
  quantity REAL,
  unit TEXT,
  PRIMARY KEY (recipe_id, position)
);

CREATE INDEX IF NOT EXISTS recipe_ingredients_name
  ON recipe_ingredients (name_normalized);

CREATE VIRTUAL TABLE IF NOT EXISTS recipe_search USING fts5(
  recipe_id UNINDEXED,
  title,
  ingredients,
  tokenize = 'porter unicode61 remove_diacritics 2'
);

CREATE TABLE IF NOT EXISTS foods (
  fdc_id INTEGER PRIMARY KEY,
  description TEXT NOT NULL,
  data_type TEXT,
  nutrients_json TEXT NOT NULL,
  portions_json TEXT
);

CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
