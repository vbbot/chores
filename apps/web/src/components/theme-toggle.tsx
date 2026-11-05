'use client';

import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      className="min-h-[44px] px-2 text-xs font-semibold underline underline-offset-4 text-secondary hover:text-foreground"
    >
      {next === 'dark' ? 'Dark' : 'Light'}
    </button>
  );
}
