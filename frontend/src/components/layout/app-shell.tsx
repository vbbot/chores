'use client';

import * as React from 'react';
import { Header } from './header';
import { Nav } from './nav';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Header />
      <div className="flex-1 flex flex-col md:flex-row">
        <Nav />
        <main className="flex-1 p-4 md:p-6 pb-28 md:pb-6 max-w-5xl">
          {children}
        </main>
      </div>
    </div>
  );
}
