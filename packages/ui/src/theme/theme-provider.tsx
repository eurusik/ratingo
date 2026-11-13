'use client';

import { useEffect, type ReactNode } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';

const COLOR_THEMES = ['dark', 'light'] as const;

export type ColorTheme = (typeof COLOR_THEMES)[number];

const DEFAULT_COLOR_THEME: ColorTheme = 'dark';

const THEME_COLORS: Record<ColorTheme, string> = {
  dark: '#060607',
  light: '#f5f5f5',
};

const THEME_ATTRIBUTES: ['class', 'data-theme'] = ['class', 'data-theme'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute={THEME_ATTRIBUTES}
      themes={[...COLOR_THEMES]}
      defaultTheme={DEFAULT_COLOR_THEME}
      enableSystem={false}
      disableTransitionOnChange
    >
      <ThemeColorMeta />
      {children}
    </NextThemesProvider>
  );
}

export function isColorTheme(value: string | undefined): value is ColorTheme {
  return COLOR_THEMES.some((theme) => theme === value);
}

function ThemeColorMeta() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (!isColorTheme(resolvedTheme)) return;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', THEME_COLORS[resolvedTheme]));
  }, [resolvedTheme]);

  return null;
}
