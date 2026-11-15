const NAVIGATION_DEBUG_EVENT = 'ratingo:navigation-debug';

export interface NavigationDebugStep {
  step: string;
  details?: Record<string, unknown>;
}

let observerCount = 0;

export function observeNavigationSteps(onStep: (step: NavigationDebugStep) => void): () => void {
  const listener = (event: Event) => onStep((event as CustomEvent<NavigationDebugStep>).detail);
  window.addEventListener(NAVIGATION_DEBUG_EVENT, listener);
  observerCount += 1;
  return () => {
    window.removeEventListener(NAVIGATION_DEBUG_EVENT, listener);
    observerCount -= 1;
  };
}

export function reportNavigationStep(step: string, details?: Record<string, unknown>): void {
  if (observerCount === 0) return;
  window.dispatchEvent(
    new CustomEvent<NavigationDebugStep>(NAVIGATION_DEBUG_EVENT, { detail: { step, details } }),
  );
}
