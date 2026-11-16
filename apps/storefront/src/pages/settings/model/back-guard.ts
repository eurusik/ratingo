'use client';

import { createContext, useContext, useEffect, type MouseEvent, type RefObject } from 'react';

export type BackGuard = (event: MouseEvent<HTMLAnchorElement>) => void;

export const BackGuardContext = createContext<RefObject<BackGuard | null> | null>(null);

export function useBackGuard(guard: BackGuard | null): void {
  const guardRef = useContext(BackGuardContext);

  useEffect(() => {
    if (!guardRef) return;
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
    };
  }, [guardRef, guard]);
}
