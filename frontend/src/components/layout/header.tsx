'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';

export function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="border-b border-border bg-background px-4 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Link href="/dashboard" className="text-lg font-bold tracking-tight">
          ChoreSync
        </Link>
      </div>

      <div className="flex items-center space-x-4">
        {user ? (
          <div className="flex items-center space-x-3 text-sm">
            <span className="text-secondary hidden sm:inline">{user.name}</span>
            <button
              onClick={logout}
              className="text-xs border border-border px-2 py-1 rounded-card hover:bg-surface font-medium"
            >
              Sign out
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="text-sm font-medium border border-border px-3 py-1.5 rounded-card hover:bg-surface"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
