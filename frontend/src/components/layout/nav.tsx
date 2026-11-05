'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const primaryNav = [
  { label: 'Dashboard', shortLabel: 'Home', href: '/dashboard' },
  { label: 'Chores', shortLabel: 'Chores', href: '/chores' },
  { label: 'Bins', shortLabel: 'Bins', href: '/bins' },
  { label: 'Shopping', shortLabel: 'Shop', href: '/shopping' },
];

const moreNav = [
  { label: 'Bills', href: '/bills' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Notes', href: '/notes' },
  { label: 'Settings', href: '/settings' },
];

export function Nav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const moreButtonRef = React.useRef<HTMLButtonElement>(null);
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!moreOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMoreOpen(false);
        moreButtonRef.current?.focus();
      }
    };

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || moreButtonRef.current?.contains(target)) {
        return;
      }
      setMoreOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handlePointerDown);
    panelRef.current?.querySelector<HTMLAnchorElement>('a')?.focus();

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handlePointerDown);
    };
  }, [moreOpen]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const moreActive = moreNav.some((item) => isActive(item.href));

  return (
    <>
      <aside className="hidden md:flex flex-col w-56 border-r border-border min-h-[calc(100vh-57px)] p-4 space-y-1 bg-surface">
        {[...primaryNav, ...moreNav].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'px-3 py-2 rounded-card text-sm font-medium transition-colors',
              isActive(item.href)
                ? 'bg-foreground text-background font-semibold'
                : 'text-foreground hover:bg-background'
            )}
          >
            {item.label}
          </Link>
        ))}
      </aside>

      {moreOpen && (
        <div
          ref={panelRef}
          id="more-sections"
          role="dialog"
          aria-label="More sections"
          className="md:hidden fixed bottom-16 left-0 right-0 z-50 border-t-2 border-foreground bg-background p-4"
        >
          <div className="grid grid-cols-2 gap-2">
            {moreNav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'px-3 py-3 rounded-card border-2 text-sm font-medium min-h-[44px] flex items-center',
                  isActive(item.href)
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-foreground'
                )}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      )}

      <nav
        aria-label="Primary"
        className="md:hidden fixed bottom-0 left-0 right-0 border-t-2 border-foreground bg-background grid grid-cols-5 z-40 pb-[env(safe-area-inset-bottom)]"
      >
        {primaryNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive(item.href) ? 'page' : undefined}
            className={cn(
              'flex items-center justify-center min-h-[56px] px-1 text-xs font-medium border-r border-border last:border-r-0',
              isActive(item.href) ? 'font-bold underline underline-offset-4' : 'text-secondary'
            )}
          >
            {item.shortLabel}
          </Link>
        ))}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => setMoreOpen((open) => !open)}
          aria-expanded={moreOpen}
          aria-controls="more-sections"
          className={cn(
            'flex items-center justify-center min-h-[56px] px-1 text-xs font-medium',
            moreActive || moreOpen ? 'font-bold underline underline-offset-4' : 'text-secondary'
          )}
        >
          More
        </button>
      </nav>
    </>
  );
}
