'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { reportNavigationStep } from '@ratingo/ui/motion';

const listeners = new Set<() => void>();
const visitedPaths: string[] = [];

function recordVisit(pathname: string): void {
  const isReturnToPrevious = visitedPaths.at(-2) === pathname;
  if (isReturnToPrevious) visitedPaths.pop();
  else visitedPaths.push(pathname);
}

export function hasPreviousRoute(): boolean {
  return visitedPaths.length > 1;
}

export function waitForRouteCommit(): Promise<void> {
  return new Promise((resolve) => {
    const listener = () => {
      listeners.delete(listener);
      resolve();
    };
    listeners.add(listener);
  });
}

export function RouteCommitSignal(): null {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== null) recordVisit(pathname);
    reportNavigationStep('route-commit', { pathname, waiting: listeners.size });
    [...listeners].forEach((listener) => listener());
  }, [pathname]);

  return null;
}
