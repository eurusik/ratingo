'use client';

import { createContext, useContext, useEffect, type MouseEvent, type RefObject } from 'react';

export type LeaveGuard = (event: MouseEvent<HTMLAnchorElement>, href: string) => void;

type LinkClickHandler = (event: MouseEvent<HTMLAnchorElement>) => void;

export const LeaveGuardContext = createContext<RefObject<LeaveGuard | null> | null>(null);

export function useLeaveGuard(guard: LeaveGuard | null): void {
  const guardRef = useContext(LeaveGuardContext);

  useEffect(() => {
    if (!guardRef) return;
    guardRef.current = guard;
    return () => {
      guardRef.current = null;
    };
  }, [guardRef, guard]);
}

export function useGuardedLink(): (href: string) => LinkClickHandler {
  const guardRef = useContext(LeaveGuardContext);
  return (href) => (event) => guardRef?.current?.(event, href);
}
