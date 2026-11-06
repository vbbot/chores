'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AltchaWidget } from '@/components/altcha-widget';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [altcha, setAltcha] = React.useState<string | null>(null);
  const [resetKey, setResetKey] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!altcha) {
      setError('Complete the verification first.');
      return;
    }

    setLoading(true);
    try {
      await apiFetch('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, altcha }),
      });
      await refreshUser();
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
      setResetKey((key) => key + 1);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen bg-background">
      <div className="absolute top-3 right-3">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 lg:flex-row lg:items-center lg:gap-16 lg:px-8 lg:py-16">
        <div className="pt-16 lg:flex-1 lg:pt-0">
          <p className="text-xl font-semibold tracking-tight">Chores</p>
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Sign in to Chores</h1>
          <p className="mt-3 max-w-sm text-base text-secondary">
            One calm place for chores, bin collections, bills, shopping, notes, and the household calendar.
          </p>
        </div>
        <div className="flex justify-center pb-12 pt-8 lg:flex-1 lg:justify-end lg:pb-0 lg:pt-0">
          <Card className="w-full max-w-sm border-heavy border-foreground p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div
                  role="alert"
                  className="p-3 text-sm rounded-card border border-destructive bg-destructive/10 text-destructive"
                >
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-1">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium mb-1">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <AltchaWidget onPayload={setAltcha} resetKey={resetKey} />
              <Button type="submit" disabled={loading || !altcha} className="w-full">
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
              <div className="text-center text-sm pt-2 text-secondary">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-semibold underline text-foreground">
                  Register
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
