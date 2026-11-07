import { randomUUID } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { isIP } from 'node:net';

import type { Recipe, RecipeIngredient } from '@chores/domain';
import { parseIngredient } from 'parse-ingredient';
import { parse as parseHtml } from 'node-html-parser';

import { estimateNutrition, getCatalogueRecipe, searchCatalogueRecipes, searchTokens } from '@chores/food-data';

import { householdCollection } from './households';
import { ApiError } from './http';

function recipeFromDoc(id: string, data: Record<string, unknown>): Recipe {
  return {
    source: 'household',
    ...(data as Omit<Recipe, 'id' | 'source'>),
    id,
  };
}

function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function listHouseholdRecipes(householdId: string): Promise<Recipe[]> {
  const result = await householdCollection(householdId, 'recipes').get();
  return result.docs
    .map((doc) => recipeFromDoc(doc.id, doc.data()))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function getHouseholdRecipe(
  householdId: string,
  recipeId: string
): Promise<Recipe> {
  const doc = await householdCollection(householdId, 'recipes').doc(recipeId).get();
  if (!doc.exists) throw new ApiError('Recipe not found', 404);
  return recipeFromDoc(doc.id, doc.data() as Record<string, unknown>);
}

export async function getRecipe(
  householdId: string,
  source: string,
  recipeId: string
): Promise<Recipe> {
  if (source === 'catalogue') {
    const recipe = getCatalogueRecipe(recipeId);
    if (!recipe) throw new ApiError('Recipe not found', 404);
    return recipe;
  }
  if (source === 'household') return getHouseholdRecipe(householdId, recipeId);
  throw new ApiError('Unknown recipe source', 400);
}

export async function searchRecipes(
  householdId: string,
  query: string,
  options: { maxTime?: number; page?: number } = {}
): Promise<Recipe[]> {
  const catalogue = searchCatalogueRecipes(query, options);
  const tokens = searchTokens(query);
  if (tokens.length === 0) return catalogue;

  const household = await listHouseholdRecipes(householdId);
  const matching = household
    .map((recipe) => {
      const text = normalise(
        `${recipe.title} ${recipe.ingredients.map((ingredient) => ingredient.name).join(' ')}`
      );
      const score = tokens.filter((token) => text.includes(token)).length;
      return { recipe, score };
    })
    .filter((entry) => entry.score === tokens.length)
    .sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title))
    .slice(0, 30)
    .map((entry) => entry.recipe);

  return [...matching, ...catalogue].slice(0, 30);
}

export async function createHouseholdRecipe(
  householdId: string,
  userId: string,
  input: {
    title: string;
    source_url?: string | null;
    source_name?: string | null;
    license?: string | null;
    servings: number;
    prep_minutes?: number | null;
    cook_minutes?: number | null;
    ingredients: string[];
    steps: string[];
    tags: string[];
  }
): Promise<Recipe> {
  const id = randomUUID();
  const ingredients: RecipeIngredient[] = input.ingredients.map((raw) => {
    const [parsed] = parseIngredient(raw);
    return {
      raw,
      name: parsed?.description?.trim() || raw.trim(),
      quantity: parsed?.quantity ?? null,
      unit: parsed?.unitOfMeasure ?? null,
    };
  });
  const recipe: Recipe = {
    id,
    source: 'household',
    title: input.title.trim(),
    servings: input.servings,
    prep_minutes: input.prep_minutes ?? null,
    cook_minutes: input.cook_minutes ?? null,
    total_minutes:
      (input.prep_minutes ?? 0) + (input.cook_minutes ?? 0) || null,
    image_url: null,
    source_url: input.source_url ?? null,
    source_name: input.source_name ?? null,
    license: input.license ?? null,
    ingredients,
    steps: input.steps,
    tags: input.tags,
    nutrition: estimateNutrition(input.ingredients, input.servings),
    created_by: userId,
    created_at: new Date().toISOString(),
  };
  const { id: _id, ...data } = recipe;
  await householdCollection(householdId, 'recipes').doc(id).set(data);
  return recipe;
}

export async function updateHouseholdRecipe(
  householdId: string,
  recipeId: string,
  patch: {
    title?: string;
    servings?: number;
    prep_minutes?: number | null;
    cook_minutes?: number | null;
    ingredients?: string[];
    steps?: string[];
    tags?: string[];
    source_url?: string | null;
    source_name?: string | null;
    license?: string | null;
  }
): Promise<Recipe> {
  const current = await getHouseholdRecipe(householdId, recipeId);
  const ingredients = patch.ingredients
    ? patch.ingredients.map((raw) => {
        const [parsed] = parseIngredient(raw);
        return {
          raw,
          name: parsed?.description?.trim() || raw.trim(),
          quantity: parsed?.quantity ?? null,
          unit: parsed?.unitOfMeasure ?? null,
        };
      })
    : current.ingredients;
  const servings = patch.servings ?? current.servings;
  const update = {
    ...patch,
    ingredients,
    nutrition: estimateNutrition(
      ingredients.map((ingredient) => ingredient.raw),
      servings
    ),
    total_minutes:
      ((patch.prep_minutes ?? current.prep_minutes ?? 0) +
        (patch.cook_minutes ?? current.cook_minutes ?? 0)) || null,
  };
  await householdCollection(householdId, 'recipes').doc(recipeId).update(update);
  return getHouseholdRecipe(householdId, recipeId);
}

export async function deleteHouseholdRecipe(
  householdId: string,
  recipeId: string
): Promise<void> {
  const ref = householdCollection(householdId, 'recipes').doc(recipeId);
  if (!(await ref.get()).exists) throw new ApiError('Recipe not found', 404);
  await ref.delete();
}

export function isPrivateIp(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split('.').map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  const value = address.toLowerCase();
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice(7);
    if (isIP(mapped) === 4) return isPrivateIp(mapped);
    const parts = mapped.split(':');
    if (parts.length === 2) {
      const high = Number.parseInt(parts[0], 16);
      const low = Number.parseInt(parts[1], 16);
      if (Number.isFinite(high) && Number.isFinite(low)) {
        return isPrivateIp(
          `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
        );
      }
    }
  }
  return (
    value === '::1' ||
    value === '::' ||
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    value.startsWith('fe8') ||
    value.startsWith('fe9') ||
    value.startsWith('fea') ||
    value.startsWith('feb')
  );
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ApiError('Enter a valid recipe URL', 400);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ApiError('Only http and https recipe links are supported', 400);
  }
  const hostname = url.hostname
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    hostname === 'metadata.google.internal'
  ) {
    throw new ApiError('That address is not allowed', 400);
  }
  if (isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      throw new ApiError('That address is not allowed', 400);
    }
    return url;
  }
  const addresses = await dns.lookup(hostname, { all: true }).catch(() => []);
  if (
    addresses.length === 0 ||
    addresses.some((entry) => isPrivateIp(entry.address))
  ) {
    throw new ApiError('That address is not allowed', 400);
  }
  return url;
}

function asString(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null;
  if (typeof value === 'number') return String(value);
  return null;
}

function durationMinutes(value: unknown): number | null {
  const text = asString(value);
  if (!text) return null;
  const match = text.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?)?$/);
  if (!match) return asNumber(value);
  return (
    Number(match[1] ?? 0) * 1440 +
    Number(match[2] ?? 0) * 60 +
    Number(match[3] ?? 0)
  );
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.]/g, ''));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record['@graph'])) return flattenJsonLd(record['@graph']);
  return [record];
}

function isRecipeType(value: unknown): boolean {
  if (typeof value === 'string') return value === 'Recipe';
  if (Array.isArray(value)) return value.some((entry) => entry === 'Recipe');
  return false;
}

function stepsFrom(value: unknown): string[] {
  if (typeof value === 'string') {
    return value
      .split(/\n+/)
      .map((step) => step.replace(/<[^>]+>/g, '').trim())
      .filter(Boolean);
  }
  if (!Array.isArray(value)) return [];
  const steps: string[] = [];
  for (const entry of value) {
    if (typeof entry === 'string') {
      steps.push(entry.replace(/<[^>]+>/g, '').trim());
    } else if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      if (record['@type'] === 'HowToSection' && Array.isArray(record.itemListElement)) {
        steps.push(...stepsFrom(record.itemListElement));
      } else {
        const text = asString(record.text) ?? asString(record.name);
        if (text) steps.push(text.replace(/<[^>]+>/g, '').trim());
      }
    }
  }
  return steps.filter(Boolean);
}

const MAX_RECIPE_PAGE_BYTES = 5_000_000;

async function readLimitedText(response: Response): Promise<string> {
  const length = Number(response.headers.get('content-length') ?? 0);
  if (length > MAX_RECIPE_PAGE_BYTES) {
    throw new ApiError('That page is too large', 413);
  }
  if (!response.body) {
    const text = await response.text();
    if (Buffer.byteLength(text) > MAX_RECIPE_PAGE_BYTES) {
      throw new ApiError('That page is too large', 413);
    }
    return text;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.length;
    if (total > MAX_RECIPE_PAGE_BYTES) {
      await reader.cancel();
      throw new ApiError('That page is too large', 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).toString('utf8');
}

async function fetchRecipePage(
  initial: URL
): Promise<{ response: Response; url: URL }> {
  let url = initial;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
      headers: { 'user-agent': 'Chores recipe importer' },
    }).catch(() => null);
    if (!response) break;
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) break;
      url = await assertSafeUrl(new URL(location, url).toString());
      continue;
    }
    return { response, url };
  }
  throw new ApiError('Could not fetch that recipe link', 422);
}

export async function importRecipeFromUrl(
  householdId: string,
  userId: string,
  rawUrl: string
): Promise<Recipe> {
  const initial = await assertSafeUrl(rawUrl);
  const { response, url } = await fetchRecipePage(initial);
  if (!response.ok) {
    throw new ApiError('Could not fetch that recipe link', 422);
  }
  const html = await readLimitedText(response);
  const root = parseHtml(html);
  const scripts = root.querySelectorAll('script[type="application/ld+json"]');
  let recipe: Record<string, unknown> | null = null;
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(script.textContent) as unknown;
      recipe = flattenJsonLd(parsed).find((entry) => isRecipeType(entry['@type'])) ?? null;
    } catch {
      // Ignore malformed JSON-LD blocks.
    }
    if (recipe) break;
  }
  if (!recipe) throw new ApiError('No recipe was found on that page', 422);

  const title = asString(recipe.name);
  const ingredients = Array.isArray(recipe.recipeIngredient)
    ? recipe.recipeIngredient.map(asString).filter((item): item is string => Boolean(item))
    : [];
  if (!title || ingredients.length === 0) {
    throw new ApiError('That page does not contain a complete recipe', 422);
  }
  const yieldValue = recipe.recipeYield;
  const servings =
    asNumber(Array.isArray(yieldValue) ? yieldValue[0] : yieldValue) ?? 4;
  const imageValue = recipe.image;
  const image =
    asString(imageValue) ??
    (Array.isArray(imageValue) ? asString(imageValue[0]) : null) ??
    (imageValue && typeof imageValue === 'object'
      ? asString((imageValue as Record<string, unknown>).url)
      : null);
  const prep = durationMinutes(recipe.prepTime);
  const cook = durationMinutes(recipe.cookTime);
  const tags = Array.isArray(recipe.recipeCategory)
    ? recipe.recipeCategory.map(asString).filter((item): item is string => Boolean(item))
    : asString(recipe.recipeCategory)
      ? [asString(recipe.recipeCategory)!]
      : [];

  const created = await createHouseholdRecipe(householdId, userId, {
    title,
    source_url: url.toString(),
    source_name: url.hostname.replace(/^www\./, ''),
    license: asString(recipe.license),
    servings: Math.max(1, Math.round(servings)),
    prep_minutes: prep,
    cook_minutes: cook,
    ingredients,
    steps: stepsFrom(recipe.recipeInstructions),
    tags,
  });
  if (image) {
    await householdCollection(householdId, 'recipes')
      .doc(created.id)
      .update({ image_url: image });
    return { ...created, image_url: image };
  }
  return created;
}
