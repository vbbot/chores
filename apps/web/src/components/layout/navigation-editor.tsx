'use client';

import * as React from 'react';
import {
  DEFAULT_NAVIGATION_ORDER,
  MOBILE_TAB_COUNT,
  normalizeNavigationOrder,
  type NavigationItemId,
} from '@chores/domain';
import {
  AllIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  GripIcon,
  SettingsIcon,
} from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useNavigationOrder, type NavigationEntry } from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface NavigationEditorContextValue {
  openEditor: () => void;
}

const NavigationEditorContext = React.createContext<NavigationEditorContextValue | null>(null);

export function useNavigationEditor(): NavigationEditorContextValue {
  const context = React.useContext(NavigationEditorContext);
  if (!context) {
    throw new Error('useNavigationEditor must be used within a NavigationEditorProvider');
  }
  return context;
}

export function NavigationEditorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const openEditor = React.useCallback(() => setOpen(true), []);
  const closeEditor = React.useCallback(() => setOpen(false), []);
  const value = React.useMemo(() => ({ openEditor }), [openEditor]);

  return (
    <NavigationEditorContext.Provider value={value}>
      {children}
      {open && <NavigationEditorDialog onClose={closeEditor} />}
    </NavigationEditorContext.Provider>
  );
}

interface NavigationEditorDialogProps {
  onClose: () => void;
}

function NavigationEditorDialog({ onClose }: NavigationEditorDialogProps) {
  const { refreshUser } = useAuth();
  const entries = useNavigationOrder();
  const entryById = React.useMemo(
    () => new Map<NavigationItemId, NavigationEntry>(entries.map((entry) => [entry.id, entry])),
    [entries]
  );

  const [draft, setDraft] = React.useState<NavigationItemId[]>(() =>
    normalizeNavigationOrder(entries.map((entry) => entry.id))
  );
  const [draggingId, setDraggingId] = React.useState<NavigationItemId | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const descriptionId = React.useId();

  const moveItem = (fromIndex: number, toIndex: number) => {
    setDraft((previous) => {
      if (toIndex < 0 || toIndex >= previous.length) return previous;
      const next = [...previous];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };

  const dropOn = (targetId: NavigationItemId) => {
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      return;
    }
    setDraft((previous) => {
      const fromIndex = previous.indexOf(draggingId);
      const toIndex = previous.indexOf(targetId);
      if (fromIndex === -1 || toIndex === -1) return previous;
      const next = [...previous];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, draggingId);
      return next;
    });
    setDraggingId(null);
  };

  const handleReset = () => {
    setDraft([...DEFAULT_NAVIGATION_ORDER]);
    setError(null);
  };

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await apiFetch('/api/v1/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ navigation_order: draft }),
      });
      await refreshUser();
      onClose();
    } catch {
      setError('Could not save your navigation order. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderRow = (entry: NavigationEntry, index: number) => {
    const isFirst = index === 0;
    const isLast = index === draft.length - 1;
    return (
      <li
        key={entry.id}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          dropOn(entry.id);
        }}
        className={cn(
          'flex min-h-[44px] items-center gap-2 rounded-btn border border-border bg-background px-2 py-1',
          draggingId === entry.id && 'opacity-60'
        )}
      >
        <span
          draggable
          aria-hidden="true"
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', entry.id);
            setDraggingId(entry.id);
          }}
          onDragEnd={() => setDraggingId(null)}
          className="flex h-11 w-6 cursor-grab items-center justify-center text-secondary active:cursor-grabbing"
        >
          <GripIcon className="h-5 w-5" />
        </span>
        <entry.Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{entry.label}</span>
          <span className="block truncate text-xs text-secondary">{entry.description}</span>
        </span>
        <button
          type="button"
          onClick={() => moveItem(index, index - 1)}
          disabled={isFirst}
          aria-label={`Move ${entry.label} up`}
          className="flex h-11 w-11 items-center justify-center rounded-btn border border-border text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowUpIcon aria-hidden="true" className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => moveItem(index, index + 1)}
          disabled={isLast}
          aria-label={`Move ${entry.label} down`}
          className="flex h-11 w-11 items-center justify-center rounded-btn border border-border text-foreground hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground disabled:pointer-events-none disabled:opacity-40"
        >
          <ArrowDownIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </li>
    );
  };

  return (
    <Dialog open onClose={handleClose} title="Customize navigation">
      <div className="flex max-h-[calc(90vh-8rem)] flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <p id={descriptionId} className="text-sm text-secondary">
            The first four destinations appear in the mobile bottom bar, and the same order is used
            everywhere.
          </p>

          <ol aria-describedby={descriptionId} className="space-y-2">
            {draft.map((id, index) => {
              const entry = entryById.get(id);
              if (!entry) return null;
              return (
                <React.Fragment key={id}>
                  {renderRow(entry, index)}
                  {index === MOBILE_TAB_COUNT - 1 && (
                    <li role="separator" aria-orientation="horizontal" className="pt-1">
                      <div className="flex items-center justify-between gap-2 border-t border-border pt-1 text-[11px] font-semibold uppercase tracking-wide text-secondary">
                        <span>Bottom bar</span>
                        <span>More in All</span>
                      </div>
                    </li>
                  )}
                </React.Fragment>
              );
            })}
          </ol>

          <ul className="space-y-2 border-t border-border pt-3">
            <li className="flex min-h-[44px] items-center gap-2 px-2 py-1 text-secondary">
              <AllIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">All</span>
                <span className="block truncate text-xs">Fixed fifth mobile tab</span>
              </span>
            </li>
            <li className="flex min-h-[44px] items-center gap-2 px-2 py-1 text-secondary">
              <SettingsIcon aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Settings</span>
                <span className="block truncate text-xs">
                  Fixed utility destination, not reorderable
                </span>
              </span>
            </li>
          </ul>

          {error && (
            <p role="alert" className="text-sm font-semibold text-destructive">
              {error}
            </p>
          )}
        </div>

        <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={saving}
            className="min-h-[44px] px-1 text-sm font-semibold underline underline-offset-4 text-foreground disabled:opacity-50"
          >
            Reset to default
          </button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
