'use client';

import { useEffect } from 'react';

const SKIP_ATTRIBUTE = 'data-skip-view-transition';
const SKIP_WINDOW_MS = 1000;

function browserMayHaveAnimated(event: PopStateEvent): boolean {
  return !('hasUAVisualTransition' in event) || event.hasUAVisualTransition !== false;
}

export function ViewTransitionTraversalGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    const onPopState = (event: PopStateEvent) => {
      if (!browserMayHaveAnimated(event)) return;
      root.setAttribute(SKIP_ATTRIBUTE, '');
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => root.removeAttribute(SKIP_ATTRIBUTE), SKIP_WINDOW_MS);
    };

    window.addEventListener('popstate', onPopState, { capture: true });
    return () => {
      window.removeEventListener('popstate', onPopState, { capture: true });
      clearTimeout(clearTimer);
      root.removeAttribute(SKIP_ATTRIBUTE);
    };
  }, []);

  return null;
}
