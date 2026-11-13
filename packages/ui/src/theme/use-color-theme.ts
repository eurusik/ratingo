'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { isColorTheme, type ColorTheme } from './theme-provider';

const subscribeToNothing = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

export function useColorTheme() {
  const { resolvedTheme, setTheme } = useTheme();
  const isHydrated = useIsHydrated();
  const theme = isHydrated && isColorTheme(resolvedTheme) ? resolvedTheme : undefined;

  const setColorTheme: (next: ColorTheme) => void = setTheme;

  return { theme, setTheme: setColorTheme };
}
