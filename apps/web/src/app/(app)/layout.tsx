'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/app-shell';
import { ConfirmProvider } from '@/components/ui/confirm-provider';
import { useAuth } from '@/lib/auth';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    } else if (!loading && user && !user.household_id) {
      router.push('/setup');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-secondary">
        Loading household data...
      </div>
    );
  }

  if (!user || !user.household_id) {
    return null;
  }

  return (
    <ConfirmProvider>
      <AppShell>{children}</AppShell>
    </ConfirmProvider>
  );
}
