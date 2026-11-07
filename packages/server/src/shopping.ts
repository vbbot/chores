import { randomUUID } from 'node:crypto';

import type { ShoppingItem, ShoppingList } from '@chores/domain';
import type { DocumentSnapshot } from 'firebase-admin/firestore';

import { householdCollection } from './households';
import { ApiError } from './http';

function itemFromDoc(id: string, data: Record<string, unknown>): ShoppingItem {
  return { id, ...(data as unknown as Omit<ShoppingItem, 'id'>) };
}

async function itemsForList(householdId: string, listId: string): Promise<ShoppingItem[]> {
  const result = await householdCollection(householdId, 'shoppingLists')
    .doc(listId)
    .collection('items')
    .orderBy('created_at', 'asc')
    .get();
  return result.docs.map((doc) => itemFromDoc(doc.id, doc.data()));
}

async function listFromDoc(
  householdId: string,
  doc: DocumentSnapshot
): Promise<ShoppingList> {
  return {
    id: doc.id,
    ...(doc.data() as Omit<ShoppingList, 'id' | 'items'>),
    items: await itemsForList(householdId, doc.id),
  };
}

export async function listShoppingLists(householdId: string): Promise<ShoppingList[]> {
  let result = await householdCollection(householdId, 'shoppingLists').get();

  if (!result.docs.some((doc) => doc.data().is_active)) {
    const id = randomUUID();
    await householdCollection(householdId, 'shoppingLists').doc(id).set({
      household_id: householdId,
      name: 'Groceries',
      is_active: true,
      created_at: new Date().toISOString(),
    });
    result = await householdCollection(householdId, 'shoppingLists').get();
  }

  return Promise.all(
    result.docs
      .filter((doc) => doc.data().is_active)
      .map((doc) => listFromDoc(householdId, doc))
  );
}

export async function createShoppingList(
  householdId: string,
  name: string
): Promise<ShoppingList> {
  const id = randomUUID();
  await householdCollection(householdId, 'shoppingLists').doc(id).set({
    household_id: householdId,
    name: name.trim(),
    is_active: true,
    created_at: new Date().toISOString(),
  });
  return listFromDoc(householdId, await householdCollection(householdId, 'shoppingLists').doc(id).get());
}

export async function addShoppingItem(
  householdId: string,
  listId: string,
  userId: string,
  input: {
    name: string;
    category?: string | null;
    quantity?: number;
    unit?: string | null;
    notes?: string | null;
    source_recipe_id?: string | null;
    source_meal_id?: string | null;
  }
): Promise<ShoppingItem> {
  const list = await householdCollection(householdId, 'shoppingLists').doc(listId).get();
  if (!list.exists) throw new ApiError('Shopping list not found', 404);

  const id = randomUUID();
  const item = {
    household_id: householdId,
    list_id: listId,
    added_by: userId,
    name: input.name.trim(),
    category: input.category ?? null,
    quantity: input.quantity ?? 1,
    unit: input.unit ?? null,
    is_checked: false,
    notes: input.notes ?? null,
    checked_at: null,
    source_recipe_id: input.source_recipe_id ?? null,
    source_meal_id: input.source_meal_id ?? null,
    created_at: new Date().toISOString(),
  };
  await householdCollection(householdId, 'shoppingLists')
    .doc(listId)
    .collection('items')
    .doc(id)
    .set(item);
  return { id, ...item };
}

async function findItem(householdId: string, itemId: string) {
  const lists = await householdCollection(householdId, 'shoppingLists').get();
  for (const list of lists.docs) {
    const items = await list.ref.collection('items').get();
    const doc = items.docs.find((candidate) => candidate.id === itemId);
    if (doc) return doc;
  }
  throw new ApiError('Shopping item not found', 404);
}

export async function updateShoppingItem(
  householdId: string,
  itemId: string,
  input: Record<string, unknown>
): Promise<ShoppingItem> {
  const doc = await findItem(householdId, itemId);
  const patch: Record<string, unknown> = {};
  Object.entries(input).forEach(([key, value]) => {
    if (value === undefined) return;
    patch[key] = key === 'name' && typeof value === 'string' ? value.trim() : value;
  });
  if (input.is_checked !== undefined) {
    patch.checked_at = input.is_checked ? new Date().toISOString() : null;
  }
  await doc.ref.update(patch);
  return itemFromDoc(doc.id, (await doc.ref.get()).data() as Record<string, unknown>);
}

export async function deleteShoppingItem(
  householdId: string,
  itemId: string
): Promise<void> {
  const doc = await findItem(householdId, itemId);
  await doc.ref.delete();
}
