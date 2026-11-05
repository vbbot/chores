'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { ShoppingItem, ShoppingList } from '@/lib/types';

export default function ShoppingPage() {
  const [list, setList] = React.useState<ShoppingList | null>(null);
  const [itemName, setItemName] = React.useState('');
  const [quantity, setQuantity] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const lists = await apiFetch<ShoppingList[]>('/api/shopping/lists');
      if (lists.length > 0) {
        setList(lists[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadList();
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!list || !itemName.trim()) return;

    try {
      const newItem = await apiFetch<ShoppingItem>(`/api/shopping/lists/${list.id}/items`, {
        method: 'POST',
        body: JSON.stringify({ name: itemName.trim(), quantity }),
      });
      setList((prev) => (prev ? { ...prev, items: [...prev.items, newItem] } : null));
      setItemName('');
      setQuantity(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add item');
    }
  };

  const toggleCheck = async (item: ShoppingItem) => {
    setError(null);
    try {
      const updated = await apiFetch<ShoppingItem>(`/api/shopping/items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_checked: !item.is_checked }),
      });
      setList((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((i) => (i.id === item.id ? updated : i)),
            }
          : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    }
  };

  const deleteItem = async (itemId: string) => {
    if (!window.confirm('Remove this item from the shopping list?')) return;
    setError(null);
    try {
      await apiFetch(`/api/shopping/items/${itemId}`, { method: 'DELETE' });
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== itemId) } : null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove item');
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Shopping list</h1>
        <div className="p-8 text-center text-sm text-secondary border border-border rounded-card">
          Loading household shopping items...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Shopping list</h1>
        <p className="text-sm text-secondary">
          Shared groceries and household supplies, visible to everyone at home.
        </p>
      </div>

      {error && (
        <div role="alert" className="p-3 text-sm rounded-card border border-destructive text-destructive">
          {error}
        </div>
      )}

      {/* Add Item Form */}
      <Card className="border-2">
        <CardContent>
          <form onSubmit={handleAddItem} className="flex gap-2">
            <Input
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="Add item (e.g. Oat milk, bin bags)"
              className="flex-1"
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

      {/* Item List */}
      {!list || list.items.length === 0 ? (
        <EmptyState
          title="Shopping list is empty"
          description="Add items above so your household knows what supplies are running low."
        />
      ) : (
        <div className="space-y-2">
          {list.items.map((item) => (
            <div
              key={item.id}
              className={`p-3 border rounded-card bg-background flex items-center justify-between ${
                item.is_checked ? 'opacity-60 border-border' : 'border-foreground'
              }`}
            >
              <div className="flex items-center space-x-3">
                <input
                  type="checkbox"
                  checked={item.is_checked}
                  onChange={() => toggleCheck(item)}
                  className="w-5 h-5 rounded border-border"
                  id={`item-${item.id}`}
                />
                <label
                  htmlFor={`item-${item.id}`}
                  className={`text-sm font-medium ${item.is_checked ? 'line-through text-secondary' : ''}`}
                >
                  {item.quantity > 1 ? `${item.quantity}x ` : ''}
                  {item.name}
                </label>
              </div>

              <button
                onClick={() => deleteItem(item.id)}
                className="text-xs text-secondary hover:text-destructive p-1"
                aria-label="Remove item"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
