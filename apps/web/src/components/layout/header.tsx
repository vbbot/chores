'use client';

import Link from 'next/link';
import { ThemeToggle } from '@/components/theme-toggle';
import { useAuth } from '@/lib/auth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-border bg-background px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          Chores
        </Link>
      </div>

      <div className="flex items-center space-x-3">
        {user ? (
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-secondary hidden sm:inline">{user.name}</span>
            <ThemeToggle />
            <button
              onClick={logout}
              className="text-xs border border-border px-3 min-h-[44px] rounded-card hover:bg-surface font-medium"
            >
              Sign out
            </button>
          </div>
        ) : (
          <>
            <ThemeToggle />
            <Link
              href="/login"
              className="text-sm font-medium border border-border px-3 min-h-[44px] rounded-card hover:bg-surface inline-flex items-center"
            >
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
