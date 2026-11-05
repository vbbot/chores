'use client';

import * as React from 'react';

export type ThemeMode = 'auto' | 'light' | 'dark';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue>({
  mode: 'auto',
  resolved: 'light',
  setMode: () => undefined,
  toggle: () => undefined,
});

const STORAGE_KEY = 'chores-theme';

function systemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(mode: ThemeMode): ResolvedTheme {
  if (mode === 'auto') return systemTheme();
  return mode;
}

function applyTheme(theme: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.add('theme-changing');
  window.setTimeout(() => root.classList.remove('theme-changing'), 180);
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', theme === 'dark' ? '#0A0A0A' : '#FFFFFF');
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>('auto');
  const [resolved, setResolved] = React.useState<ResolvedTheme>('light');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    const initial: ThemeMode =
      stored === 'light' || stored === 'dark' || stored === 'auto' ? stored : 'auto';
    setModeState(initial);
    setResolved(resolve(initial));
    setReady(true);
  }, []);

  React.useEffect(() => {
    if (!ready) return;
    applyTheme(resolved);
    if (mode !== 'auto') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      const next = media.matches ? 'dark' : 'light';
      setResolved(next);
      applyTheme(next);
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, [mode, resolved, ready]);

  const setMode = React.useCallback((nextMode: ThemeMode) => {
    const next = resolve(nextMode);
    setModeState(nextMode);
    setResolved(next);
    window.localStorage.setItem(STORAGE_KEY, nextMode);
    applyTheme(next);
  }, []);

  const toggle = React.useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  return (
    <ThemeContext.Provider value={{ mode, resolved, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return React.useContext(ThemeContext);
}
