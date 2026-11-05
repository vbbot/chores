'use client';

import { MoonIcon, SunIcon } from '@/components/icons';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
  const { resolved, toggle } = useTheme();
  const next = resolved === 'dark' ? 'light' : 'dark';
  const Icon = next === 'dark' ? MoonIcon : SunIcon;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-btn text-secondary hover:text-foreground hover:bg-surface transition-colors"
    >
      <Icon className="w-5 h-5" />
    </button>
  );
}
