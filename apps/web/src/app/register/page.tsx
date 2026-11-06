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

export default function RegisterPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [householdName, setHouseholdName] = React.useState('');
  const [inviteCode, setInviteCode] = React.useState('');
  const [mode, setMode] = React.useState<'create' | 'join'>('create');
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
      const payload: Record<string, string> = { name, email, password, altcha };
      if (mode === 'create') {
        if (!householdName.trim()) throw new Error('Please enter a household name');
        payload.household_name = householdName.trim();
      } else {
        if (!inviteCode.trim()) throw new Error('Please enter an invite code');
        payload.invite_code = inviteCode.trim();
      }

      await apiFetch('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      await refreshUser();
      router.push(mode === 'join' ? '/dashboard' : '/setup');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <h1 className="mt-6 text-3xl font-semibold tracking-tight">Create your account</h1>
          <p className="mt-3 max-w-sm text-base text-secondary">
            Set up a shared home for chores, bins, bills, shopping, notes, and the household calendar.
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
                <label htmlFor="name" className="block text-sm font-medium mb-1">
                  Your name
                </label>
                <Input
                  id="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alex Smith"
                />
              </div>
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
                  placeholder="alex@example.com"
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

              <div className="pt-2 border-t border-border">
                <div className="flex rounded-card border border-border p-1 mb-3">
                  <button
                    type="button"
                    onClick={() => setMode('create')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-card transition-colors ${
                      mode === 'create' ? 'bg-foreground text-background' : 'text-secondary'
                    }`}
                  >
                    New household
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('join')}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-card transition-colors ${
                      mode === 'join' ? 'bg-foreground text-background' : 'text-secondary'
                    }`}
                  >
                    Join existing
                  </button>
                </div>

                {mode === 'create' ? (
                  <div>
                    <label htmlFor="hh_name" className="block text-sm font-medium mb-1">
                      Household name
                    </label>
                    <Input
                      id="hh_name"
                      required
                      value={householdName}
                      onChange={(e) => setHouseholdName(e.target.value)}
                      placeholder="24 Elm Street"
                    />
                  </div>
                ) : (
                  <div>
                    <label htmlFor="inv_code" className="block text-sm font-medium mb-1">
                      Invite code
                    </label>
                    <Input
                      id="inv_code"
                      required
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="8 characters"
                    />
                  </div>
                )}
              </div>

              <AltchaWidget onPayload={setAltcha} resetKey={resetKey} />
              <Button type="submit" disabled={loading || !altcha} className="w-full">
                {loading ? 'Creating account...' : 'Create account'}
              </Button>
              <div className="text-center text-sm pt-2 text-secondary">
                Already registered?{' '}
                <Link href="/login" className="font-semibold underline text-foreground">
                  Sign in
                </Link>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
