'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { isNavigationItemActive, useNavigationOrder } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { GripIcon, SettingsIcon } from '@/components/icons';
import { useNavigationEditor } from '@/components/layout/navigation-editor';

export function DesktopRail({ onPrefetch }: { onPrefetch?: (href: string) => void }) {
  const pathname = usePathname();
  const navigation = useNavigationOrder();
  const { openEditor } = useNavigationEditor();
  const settingsActive = pathname.startsWith('/settings');

  return (
    <aside className="hidden md:flex md:flex-col md:w-56 md:shrink-0 md:self-start md:sticky md:top-[60px] md:h-[calc(100vh-60px)] border-r border-border bg-background">
      <nav aria-label="Primary" className="flex-1 overflow-y-auto p-2 space-y-1">
        {navigation.map((item) => {
          const active = isNavigationItemActive(pathname, item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              onMouseEnter={() => onPrefetch?.(item.href)}
              onFocus={() => onPrefetch?.(item.href)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex items-center gap-3 min-h-[44px] px-4 text-sm transition-colors',
                active
                  ? 'text-foreground font-semibold'
                  : 'text-secondary hover:text-foreground hover:bg-surface'
              )}
            >
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent"
                />
              ) : null}
              <item.Icon className="h-5 w-5 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-border p-2 space-y-1">
        <button
          type="button"
          onClick={openEditor}
          className="flex w-full items-center gap-3 min-h-[44px] px-4 text-sm text-secondary hover:text-foreground hover:bg-surface transition-colors text-left"
        >
          <GripIcon className="h-5 w-5 shrink-0" />
          <span>Customize navigation</span>
        </button>
        <Link
          href="/settings"
          aria-current={settingsActive ? 'page' : undefined}
          className={cn(
            'relative flex w-full items-center gap-3 min-h-[44px] px-4 text-sm transition-colors',
            settingsActive
              ? 'text-foreground font-semibold'
              : 'text-secondary hover:text-foreground hover:bg-surface'
          )}
        >
          {settingsActive ? (
            <span
              aria-hidden="true"
              className="absolute left-0 top-2 bottom-2 w-0.5 bg-accent"
            />
          ) : null}
          <SettingsIcon className="h-5 w-5 shrink-0" />
          <span>Settings</span>
        </Link>
      </div>
    </aside>
  );
}
