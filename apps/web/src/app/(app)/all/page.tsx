'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAVIGATION_GROUPS } from '@chores/domain';
import { SettingsIcon } from '@/components/icons';
import { useNavigationEditor } from '@/components/layout/navigation-editor';
import { Button } from '@/components/ui/button';
import {
  isNavigationItemActive,
  useNavigationOrder,
  type NavigationEntry,
} from '@/lib/navigation';
import { cn } from '@/lib/utils';

interface DestinationRowProps {
  href: string;
  label: string;
  description: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  active: boolean;
}

function DestinationRow({ href, label, description, Icon, active }: DestinationRowProps) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-16 items-center gap-3 border-l-2 border-transparent px-3 py-3 transition-colors hover:bg-surface',
        active && 'border-accent bg-surface'
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-card border border-border bg-background',
          active && 'border-accent text-accent'
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-secondary">{description}</span>
      </span>
    </Link>
  );
}

export default function AllPage() {
  const pathname = usePathname();
  const entries = useNavigationOrder();
  const { openEditor } = useNavigationEditor();

  const groupEntries = (group: string): NavigationEntry[] =>
    entries.filter((entry) => entry.group === group);

  return (
    <div className="space-y-8 pb-24 md:pb-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 basis-64">
          <h1 className="text-2xl font-semibold">All destinations</h1>
          <p className="mt-1 text-sm text-secondary">
            The first four destinations form your mobile bottom bar.
          </p>
        </div>
        <Button variant="secondary" onClick={openEditor}>
          Edit navigation
        </Button>
      </header>

      {NAVIGATION_GROUPS.map((group) => {
        const items = groupEntries(group.id);
        if (items.length === 0) return null;

        return (
          <section key={group.id} aria-labelledby={`${group.id}-heading`}>
            <h2 id={`${group.id}-heading`} className="text-lg font-semibold">
              {group.label}
            </h2>
            <p className="mt-1 text-sm text-secondary">{group.description}</p>
            <div className="mt-3 divide-y divide-border rounded-card border border-border">
              {items.map((item) => (
                <DestinationRow
                  key={item.id}
                  href={item.href}
                  label={item.label}
                  description={item.description}
                  Icon={item.Icon}
                  active={isNavigationItemActive(pathname, item.href)}
                />
              ))}
            </div>
          </section>
        );
      })}

      <section aria-labelledby="account-heading">
        <h2 id="account-heading" className="text-lg font-semibold">
          Account
        </h2>
        <div className="mt-3 divide-y divide-border rounded-card border border-border">
          <DestinationRow
            href="/settings"
            label="Settings"
            description="Navigation, household, reminders, and devices"
            Icon={SettingsIcon}
            active={isNavigationItemActive(pathname, '/settings')}
          />
        </div>
      </section>
    </div>
  );
}
