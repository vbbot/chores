'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  allDestination,
  isNavigationItemActive,
  needsAllTab,
  useMobileNavigation,
} from '@/lib/navigation';

export function MobileTabs() {
  const pathname = usePathname();
  const mobileItems = useMobileNavigation();

  const activeIndex = mobileItems.findIndex((item) =>
    isNavigationItemActive(pathname, item.href)
  );
  const allActive = needsAllTab(pathname, mobileItems);
  const currentIndex = allActive ? 4 : Math.max(0, activeIndex);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 grid grid-cols-5 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {mobileItems.map((item, index) => {
        const active = index === activeIndex && !allActive;
        return (
          <Link
            key={item.id}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 min-w-[44px] text-xs text-center transition-colors',
              active ? 'font-semibold text-foreground' : 'text-secondary'
            )}
          >
            <item.Icon className="w-5 h-5" aria-hidden="true" />
            <span>{item.shortLabel}</span>
          </Link>
        );
      })}

      <Link
        href={allDestination.href}
        aria-current={allActive ? 'page' : undefined}
        className={cn(
          'flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 min-w-[44px] text-xs text-center transition-colors',
          allActive ? 'font-semibold text-foreground' : 'text-secondary'
        )}
      >
        <allDestination.Icon className="w-5 h-5" aria-hidden="true" />
        <span>{allDestination.shortLabel}</span>
      </Link>

      <span
        aria-hidden="true"
        className="absolute bottom-[env(safe-area-inset-bottom)] left-0 h-0.5 w-1/5 bg-accent transition-transform duration-200 ease-zune"
        style={{ transform: `translateX(${currentIndex * 100}%)` }}
      />
    </nav>
  );
}
