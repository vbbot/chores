'use client';

import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useApiQuery } from '@/lib/query';
import { queryKeys } from '@/lib/query-keys';
import { ShoppingItem, ShoppingList } from '@/lib/types';

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: ShoppingItem;
  onToggle: (item: ShoppingItem) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="p-3 border border-border rounded-card bg-background flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          checked={item.is_checked}
          onChange={() => onToggle(item)}
          className="w-5 h-5 rounded border-border"
          id={`item-${item.id}`}
        />
        <label
          htmlFor={`item-${item.id}`}
          className={`text-sm font-medium ${
            item.is_checked ? 'line-through text-secondary' : ''
          }`}
        >
          {item.quantity > 1 ? `${item.quantity}x ` : ''}
          {item.name}
        </label>
      </div>

      <button
        onClick={() => onDelete(item.id)}
        className="text-xs text-secondary hover:text-destructive min-h-[44px] px-1"
        aria-label="Remove item"
      >
        Remove
      </button>
    </div>
  );
}

export default function ShoppingPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useApiQuery<ShoppingList[]>(
    queryKeys.shopping,
    '/api/v1/shopping/lists'
  );
  const list = data?.[0] ?? null;
  const [itemName, setItemName] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!list || !itemName.trim()) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/shopping/lists/${list.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ name: itemName.trim(), quantity }),
      });
      setItemName('');
      setQuantity(1);
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const toggleCheck = async (item: ShoppingItem) => {
    setActionError(null);
    try {
      await apiFetch(`/api/v1/shopping/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_checked: !item.is_checked }),
      });
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Remove this item from the shopping list?')) return;
    setActionError(null);
    try {
      await apiFetch(`/api/v1/shopping/items/${itemId}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: queryKeys.shopping });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  if (isLoading && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Shopping list</h1>
        <div className="p-8 text-sm text-secondary border border-border rounded-card">
          Loading household shopping items...
        </div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">Shopping list</h1>
        <div role="alert" className="p-4 border border-destructive text-destructive rounded-card text-sm">
          {error instanceof Error ? error.message : 'Could not load the shopping list.'}
        </div>
      </div>
    );
  }

  const items = list?.items ?? [];
  const unchecked = items.filter((item) => !item.is_checked);
  const checked = items.filter((item) => item.is_checked);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Shopping list</h1>
        <p className="text-sm text-secondary">
          Shared groceries and household supplies, visible to everyone at home.
        </p>
      </div>

      {(actionError || error) && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {actionError ?? (error instanceof Error ? error.message : 'Something went wrong.')}
        </div>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleAddItem} className="flex flex-wrap gap-2">
            <Input
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Add item (e.g. Oat milk, bin bags)"
              className="flex-1 min-w-[10rem]"
            />
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              className="w-20"
            />
            <Button type="submit">Add</Button>
          </form>
        </CardContent>
      </Card>

      {items.length === 0 ? (
        <EmptyState
          title="Shopping list is empty"
          description="Add items above so your household knows what supplies are running low."
        />
      ) : (
        <div className="space-y-8">
          {unchecked.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-lg font-semibold border-b border-border pb-2">
                To get
              </h2>
              {unchecked.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggleCheck}
                  onDelete={deleteItem}
                />
              ))}
            </section>
          )}

          {checked.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-secondary border-b border-border pb-2">
                In the basket
              </h2>
              {checked.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onToggle={toggleCheck}
                  onDelete={deleteItem}
                />
              ))}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
