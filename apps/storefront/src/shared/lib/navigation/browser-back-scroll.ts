'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { afterNextPaint } from './next-paint';
import { waitForRouteCommit } from './route-commit';
import { rememberWindowScroll, restoreRememberedScroll } from './scroll-memory';

const ROUTE_COMMIT_TIMEOUT_MS = 1000;

function routeCommitOrTimeout(): Promise<void> {
  return Promise.race([
    waitForRouteCommit(),
    new Promise<void>((resolve) => setTimeout(resolve, ROUTE_COMMIT_TIMEOUT_MS)),
  ]);
}

export function BrowserBackScrollRestorer(): null {
  const pathname = usePathname();
  const renderedPathname = useRef(pathname);

  useEffect(() => {
    renderedPathname.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let isReturning = false;

    const onScroll = () => {
      if (!isReturning) rememberWindowScroll();
    };
    const onPopState = () => {
      isReturning = true;
      const isSamePage = window.location.pathname === renderedPathname.current;
      void (isSamePage ? afterNextPaint() : routeCommitOrTimeout()).then(() => {
        restoreRememberedScroll();
        isReturning = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('popstate', onPopState);
    };
  }, []);

  return null;
}
