import { randomUUID } from 'node:crypto';

import type {
  MealIdea,
  MealPlanEntry,
  MealShoppingResult,
  MealSlot,
} from '@chores/domain';
import type { User } from '@chores/domain';

import { dbAdmin } from './firebase';
import { householdCollection } from './households';
import { ApiError } from './http';
import { getRecipe } from './recipes';
import {
  addShoppingItem,
  listShoppingLists,
  updateShoppingItem,
} from './shopping';
import { listMembers } from './users';

function ideaFromDoc(id: string, data: Record<string, unknown>): Omit<MealIdea, 'suggested_by_name' | 'votes' | 'voted_by_me'> {
  return { id, ...(data as Omit<MealIdea, 'id' | 'suggested_by_name' | 'votes' | 'voted_by_me'>) };
}

function planFromDoc(id: string, data: Record<string, unknown>): MealPlanEntry {
  return { id, ...(data as Omit<MealPlanEntry, 'id'>) };
}

async function memberNames(householdId: string): Promise<Map<string, string>> {
  const members = await listMembers(householdId);
  return new Map(members.map((member) => [member.id, member.name]));
}

export async function listMealIdeas(
  householdId: string,
  userId: string
): Promise<MealIdea[]> {
  const [result, names] = await Promise.all([
    householdCollection(householdId, 'mealIdeas').orderBy('created_at', 'desc').limit(100).get(),
    memberNames(householdId),
  ]);
  return Promise.all(
    result.docs.map(async (doc) => {
      const base = ideaFromDoc(doc.id, doc.data());
      const votes = await doc.ref.collection('votes').get();
      return {
        ...base,
        suggested_by_name: names.get(base.suggested_by) ?? 'Someone',
        votes: votes.size,
        voted_by_me: votes.docs.some((vote) => vote.id === userId),
      };
    })
  );
}

export async function createMealIdea(
  householdId: string,
  userId: string,
  input: {
    title?: string;
    recipe_source: 'catalogue' | 'household' | 'free_text';
    recipe_id?: string | null;
    note?: string | null;
    suggested_for_date?: string | null;
    suggested_for_slot?: MealSlot | null;
  }
): Promise<MealIdea> {
  if (Boolean(input.suggested_for_date) !== Boolean(input.suggested_for_slot)) {
    throw new ApiError('Choose both a day and a meal, or neither', 400);
  }
  let title = input.title?.trim() ?? '';
  if (input.recipe_source !== 'free_text' && input.recipe_id) {
    const recipe = await getRecipe(householdId, input.recipe_source, input.recipe_id);
    title = title || recipe.title;
  }
  if (!title) throw new ApiError('Give the meal a name or choose a recipe', 400);

  const id = randomUUID();
  const now = new Date().toISOString();
  const idea = {
    household_id: householdId,
    title,
    recipe_source: input.recipe_source,
    recipe_id: input.recipe_id ?? null,
    note: input.note?.trim() || null,
    suggested_by: userId,
    status: 'idea' as const,
    suggested_for_date: input.suggested_for_date ?? null,
    suggested_for_slot: input.suggested_for_slot ?? null,
    created_at: now,
  };
  const ref = householdCollection(householdId, 'mealIdeas').doc(id);
  const batch = dbAdmin().batch();
  batch.set(ref, idea);
  batch.set(ref.collection('votes').doc(userId), { created_at: now });
  await batch.commit();
  const names = await memberNames(householdId);
  return {
    id,
    ...idea,
    suggested_by_name: names.get(userId) ?? 'Someone',
    votes: 1,
    voted_by_me: true,
  };
}

export async function deleteMealIdea(
  householdId: string,
  ideaId: string,
  user: User
): Promise<void> {
  const ref = householdCollection(householdId, 'mealIdeas').doc(ideaId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Meal idea not found', 404);
  if (doc.data()?.suggested_by !== user.id && user.role !== 'admin') {
    throw new ApiError('Only the person who suggested this meal or an admin can remove it', 403);
  }
  await ref.delete();
}

export async function toggleMealIdeaVote(
  householdId: string,
  ideaId: string,
  userId: string
): Promise<{ votes: number; voted: boolean }> {
  const idea = householdCollection(householdId, 'mealIdeas').doc(ideaId);
  if (!(await idea.get()).exists) throw new ApiError('Meal idea not found', 404);
  const vote = idea.collection('votes').doc(userId);
  const exists = (await vote.get()).exists;
  if (exists) await vote.delete();
  else await vote.set({ created_at: new Date().toISOString() });
  const votes = await idea.collection('votes').get();
  return { votes: votes.size, voted: !exists };
}

export async function listMealPlan(
  householdId: string,
  from: string,
  to: string
): Promise<MealPlanEntry[]> {
  const [result, names] = await Promise.all([
    householdCollection(householdId, 'mealPlan').where('date', '>=', from).get(),
    memberNames(householdId),
  ]);
  return result.docs
    .map((doc) => {
      const entry = planFromDoc(doc.id, doc.data());
      return {
        ...entry,
        cook_name: entry.cook_id ? names.get(entry.cook_id) ?? null : null,
      };
    })
    .filter((entry) => entry.date <= to)
    .sort((a, b) => a.date.localeCompare(b.date) || a.slot.localeCompare(b.slot));
}

export async function getMealPlanEntry(
  householdId: string,
  entryId: string
): Promise<MealPlanEntry> {
  const doc = await householdCollection(householdId, 'mealPlan').doc(entryId).get();
  if (!doc.exists) throw new ApiError('Planned meal not found', 404);
  return planFromDoc(doc.id, doc.data() as Record<string, unknown>);
}

export async function upsertMealPlanEntry(
  householdId: string,
  input: {
    date: string;
    slot: MealSlot;
    recipe_source: 'catalogue' | 'household' | 'free_text';
    recipe_id?: string | null;
    recipe_title: string;
    servings: number;
    cook_id?: string | null;
    serve_time?: string | null;
    idea_id?: string | null;
    status?: 'planned' | 'cooked' | 'skipped';
  }
): Promise<MealPlanEntry> {
  if (input.recipe_source !== 'free_text' && input.recipe_id) {
    await getRecipe(householdId, input.recipe_source, input.recipe_id);
  }
  if (input.cook_id) {
    const members = await listMembers(householdId);
    if (!members.some((member) => member.id === input.cook_id)) {
      throw new ApiError('Cook must be a household member', 400);
    }
  }
  const id = `${input.date}_${input.slot}`;
  const existing = await householdCollection(householdId, 'mealPlan').doc(id).get();
  const previousIdeaId = existing.exists
    ? ((existing.data()?.idea_id as string | null | undefined) ?? null)
    : null;
  const ideaRef = input.idea_id
    ? householdCollection(householdId, 'mealIdeas').doc(input.idea_id)
    : null;
  const ideaExists = ideaRef ? (await ideaRef.get()).exists : false;
  const now = new Date().toISOString();
  const entry = {
    household_id: householdId,
    date: input.date,
    slot: input.slot,
    recipe_source: input.recipe_source,
    recipe_id: input.recipe_id ?? null,
    recipe_title: input.recipe_title.trim(),
    servings: input.servings,
    cook_id: input.cook_id ?? null,
    serve_time: input.serve_time ?? null,
    idea_id: ideaExists && input.idea_id ? input.idea_id : null,
    status: input.status ?? 'planned',
    created_at: existing.exists ? (existing.data()?.created_at as string) : now,
    updated_at: now,
  };
  const planRef = householdCollection(householdId, 'mealPlan').doc(id);
  const batch = dbAdmin().batch();
  batch.set(planRef, entry, { merge: true });
  if (previousIdeaId && previousIdeaId !== entry.idea_id) {
    const previousIdeaRef = householdCollection(householdId, 'mealIdeas').doc(
      previousIdeaId
    );
    if ((await previousIdeaRef.get()).exists) {
      batch.set(previousIdeaRef, { status: 'idea' }, { merge: true });
    }
  }
  if (ideaExists && ideaRef) {
    batch.update(ideaRef, { status: 'planned' });
  }
  await batch.commit();
  const names = await memberNames(householdId);
  return {
    id,
    ...entry,
    cook_name: entry.cook_id ? names.get(entry.cook_id) ?? null : null,
  };
}

export async function deleteMealPlanEntry(
  householdId: string,
  entryId: string
): Promise<void> {
  const ref = householdCollection(householdId, 'mealPlan').doc(entryId);
  const doc = await ref.get();
  if (!doc.exists) throw new ApiError('Planned meal not found', 404);
  const ideaId = doc.data()?.idea_id as string | null | undefined;
  if (ideaId) {
    const ideaRef = householdCollection(householdId, 'mealIdeas').doc(ideaId);
    const ideaExists = (await ideaRef.get()).exists;
    const batch = dbAdmin().batch();
    batch.delete(ref);
    if (ideaExists) {
      batch.set(ideaRef, { status: 'idea' }, { merge: true });
    }
    await batch.commit();
    return;
  }
  await ref.delete();
}

const CATEGORY_HINTS: [string, string][] = [
  ['milk', 'Dairy'],
  ['cheese', 'Dairy'],
  ['butter', 'Dairy'],
  ['yoghurt', 'Dairy'],
  ['egg', 'Dairy'],
  ['chicken', 'Meat'],
  ['beef', 'Meat'],
  ['pork', 'Meat'],
  ['salmon', 'Fish'],
  ['fish', 'Fish'],
  ['onion', 'Produce'],
  ['garlic', 'Produce'],
  ['tomato', 'Produce'],
  ['carrot', 'Produce'],
  ['potato', 'Produce'],
  ['spinach', 'Produce'],
  ['broccoli', 'Produce'],
  ['banana', 'Produce'],
  ['apple', 'Produce'],
  ['rice', 'Pantry'],
  ['pasta', 'Pantry'],
  ['flour', 'Pantry'],
  ['sugar', 'Pantry'],
  ['oil', 'Pantry'],
  ['lentil', 'Pantry'],
  ['chickpea', 'Pantry'],
  ['bread', 'Bakery'],
];

function categoryFor(name: string): string | null {
  const value = name.toLowerCase();
  return CATEGORY_HINTS.find(([hint]) => value.includes(hint))?.[1] ?? null;
}

function normaliseName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function resolveShoppingList(householdId: string, listId?: string | null) {
  const lists = await listShoppingLists(householdId);
  const list = listId
    ? lists.find((candidate) => candidate.id === listId)
    : lists[0];
  if (!list) throw new ApiError('Shopping list not found', 404);
  return list;
}

async function mergeRecipeIntoList(
  householdId: string,
  userId: string,
  list: Awaited<ReturnType<typeof resolveShoppingList>>,
  recipe: Awaited<ReturnType<typeof getRecipe>>,
  servings: number,
  sourceRecipeId: string,
  sourceMealId: string | null
): Promise<MealShoppingResult> {
  const factor = servings / Math.max(1, recipe.servings);
  let added = 0;
  let merged = 0;
  let skipped = 0;
  const items: MealShoppingResult['items'] = [];

  for (const ingredient of recipe.ingredients) {
    if (!ingredient.name) {
      skipped += 1;
      continue;
    }
    const quantity =
      ingredient.quantity === null
        ? null
        : Math.round(ingredient.quantity * factor * 100) / 100;
    const existing = list.items.find(
      (item) =>
        !item.is_checked &&
        normaliseName(item.name) === normaliseName(ingredient.name) &&
        (item.unit ?? null) === (ingredient.unit ?? null)
    );
    if (existing) {
      await updateShoppingItem(householdId, existing.id, {
        quantity: Math.round((existing.quantity + (quantity ?? 1)) * 100) / 100,
        source_recipe_id: sourceRecipeId,
        source_meal_id: sourceMealId,
      });
      merged += 1;
    } else {
      const created = await addShoppingItem(householdId, list.id, userId, {
        name: ingredient.name,
        quantity: quantity ?? 1,
        unit: ingredient.unit,
        category: categoryFor(ingredient.name),
        source_recipe_id: sourceRecipeId,
        source_meal_id: sourceMealId,
      });
      list.items.push(created);
      added += 1;
    }
    items.push({ name: ingredient.name, quantity, unit: ingredient.unit });
  }

  return { added, merged, skipped, items };
}

export async function addRecipeToShopping(
  householdId: string,
  userId: string,
  source: 'catalogue' | 'household',
  recipeId: string,
  servings: number,
  listId?: string | null
): Promise<MealShoppingResult> {
  const recipe = await getRecipe(householdId, source, recipeId);
  const list = await resolveShoppingList(householdId, listId);
  const sourceRecipeId = source === 'catalogue' ? recipeId : `household:${recipeId}`;
  return mergeRecipeIntoList(
    householdId,
    userId,
    list,
    recipe,
    servings,
    sourceRecipeId,
    null
  );
}

export async function addPlannedMealToShopping(
  householdId: string,
  userId: string,
  entryId: string,
  listId?: string | null
): Promise<MealShoppingResult> {
  const entry = await getMealPlanEntry(householdId, entryId);
  if (entry.recipe_source === 'free_text' || !entry.recipe_id) {
    throw new ApiError('This meal has no recipe ingredients', 400);
  }
  const recipe = await getRecipe(householdId, entry.recipe_source, entry.recipe_id);
  const list = await resolveShoppingList(householdId, listId);
  const sourceRecipeId =
    entry.recipe_source === 'catalogue'
      ? entry.recipe_id
      : `household:${entry.recipe_id}`;
  return mergeRecipeIntoList(
    householdId,
    userId,
    list,
    recipe,
    entry.servings,
    sourceRecipeId,
    entry.id
  );
}
