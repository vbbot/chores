'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SettingsIcon } from '@/components/icons';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth';

export function Header() {
  const { user } = useAuth();
  const pathname = usePathname();
  const settingsActive = pathname === '/settings';

  return (
    <header className="border-b border-border bg-background px-4 min-h-[60px] flex items-center justify-between">
      <Link
        href="/dashboard"
        className="text-xl font-semibold tracking-tight min-h-[44px] inline-flex items-center"
      >
        Chores
      </Link>

      <div className="flex items-center gap-1">
        {user && (
          <span className="text-xs text-secondary hidden sm:inline mr-2">{user.name}</span>
        )}
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="Settings"
          title="Settings"
          aria-current={settingsActive ? 'page' : undefined}
          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-btn transition-colors ${
            settingsActive
              ? 'text-accent bg-surface'
              : 'text-secondary hover:text-foreground hover:bg-surface'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
        </Link>
      </div>
    </header>
  );
}
