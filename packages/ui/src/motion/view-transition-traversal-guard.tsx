'use client';

import { useEffect } from 'react';
import {
  SKIP_VIEW_TRANSITION_ATTRIBUTE,
  consumeProgrammaticBack,
  installNavigationTransitionGuard,
} from './navigation-transition';
import { reportNavigationStep } from './navigation-debug';

const SKIP_WINDOW_MS = 1000;

function browserMayHaveAnimated(event: PopStateEvent): boolean {
  return !('hasUAVisualTransition' in event) || event.hasUAVisualTransition !== false;
}

export function ViewTransitionTraversalGuard() {
  useEffect(() => {
    const root = document.documentElement;
    let clearTimer: ReturnType<typeof setTimeout> | undefined;

    installNavigationTransitionGuard();

    const onPopState = (event: PopStateEvent) => {
      const isProgrammaticBack = consumeProgrammaticBack();
      reportNavigationStep('popstate', {
        isProgrammaticBack,
        browserMayHaveAnimated: browserMayHaveAnimated(event),
      });
      if (isProgrammaticBack || !browserMayHaveAnimated(event)) return;
      root.setAttribute(SKIP_VIEW_TRANSITION_ATTRIBUTE, '');
      clearTimeout(clearTimer);
      clearTimer = setTimeout(
        () => root.removeAttribute(SKIP_VIEW_TRANSITION_ATTRIBUTE),
        SKIP_WINDOW_MS,
      );
    };

    window.addEventListener('popstate', onPopState, { capture: true });
    return () => {
      window.removeEventListener('popstate', onPopState, { capture: true });
      clearTimeout(clearTimer);
      root.removeAttribute(SKIP_VIEW_TRANSITION_ATTRIBUTE);
    };
  }, []);

  return null;
}
