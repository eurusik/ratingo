import { moveSharedElementsOnCompositor } from './compositor-morph';
import { reportNavigationStep } from './navigation-debug';

export const NAV_FORWARD_TRANSITION = 'nav-forward';
export const NAV_BACK_TRANSITION = 'nav-back';

const NAV_TRANSITION_ATTRIBUTE = 'data-nav-transition';
export const SKIP_VIEW_TRANSITION_ATTRIBUTE = 'data-skip-view-transition';
const PROGRAMMATIC_BACK_TTL_MS = 2000;
const NAVIGATION_TIMEOUT_MS = 1000;

type StartViewTransition = (options: {
  update: () => Promise<void>;
  types: string[];
}) => ViewTransition;

let activeNavigation: ViewTransition | null = null;
let runningAnimationSettled: Promise<void> | null = null;
let programmaticBackAt: number | null = null;
let isGuardInstalled = false;

export function markProgrammaticBack(): void {
  programmaticBackAt = Date.now();
}

export function consumeProgrammaticBack(): boolean {
  if (programmaticBackAt === null) return false;
  const isFresh = Date.now() - programmaticBackAt <= PROGRAMMATIC_BACK_TTL_MS;
  programmaticBackAt = null;
  return isFresh;
}

function canAnimateNavigation(): boolean {
  return (
    typeof document.startViewTransition === 'function' &&
    document.visibilityState !== 'hidden' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function withTimeout(promise: Promise<void>): Promise<void> {
  return Promise.race([
    promise,
    new Promise<void>((resolve) => setTimeout(resolve, NAVIGATION_TIMEOUT_MS)),
  ]);
}

export function runningNavigationAnimation(): Promise<void> | null {
  return runningAnimationSettled;
}

export function installNavigationTransitionGuard(): void {
  if (isGuardInstalled || typeof document.startViewTransition !== 'function') return;
  isGuardInstalled = true;
  const original = document.startViewTransition.bind(document);

  document.startViewTransition = ((...args: Parameters<typeof original>) => {
    if (activeNavigation) {
      reportNavigationStep('guard-blocked', { reason: 'navigation-in-progress' });
      throw new DOMException('Navigation view transition is in progress', 'InvalidStateError');
    }
    if (document.documentElement.hasAttribute(SKIP_VIEW_TRANSITION_ATTRIBUTE)) {
      reportNavigationStep('guard-blocked', { reason: 'browser-animated-traversal' });
      throw new DOMException('The browser already animated this navigation', 'InvalidStateError');
    }
    return original(...args);
  }) as typeof document.startViewTransition;
}

function navigateWithoutTransition(
  navigate: () => void,
  committed: () => Promise<void>,
): Promise<void> {
  navigate();
  return withTimeout(committed()).catch(() => {});
}

export function runNavigationTransition(
  types: string[],
  navigate: () => void,
  committed: () => Promise<void>,
): Promise<void> {
  if (activeNavigation || !canAnimateNavigation()) {
    reportNavigationStep('transition-skipped', {
      types,
      isBusy: activeNavigation !== null,
      canAnimate: canAnimateNavigation(),
    });
    return navigateWithoutTransition(navigate, committed);
  }

  const start = document.startViewTransition.bind(document) as unknown as StartViewTransition;
  const root = document.documentElement;
  root.removeAttribute(SKIP_VIEW_TRANSITION_ATTRIBUTE);
  root.setAttribute(NAV_TRANSITION_ATTRIBUTE, types.join(' '));
  let transition: ViewTransition;
  try {
    transition = start({
      types,
      update: () => {
        reportNavigationStep('transition-update', { types });
        navigate();
        return withTimeout(committed());
      },
    });
  } catch (error) {
    reportNavigationStep('transition-refused', { types, error: String(error) });
    root.removeAttribute(NAV_TRANSITION_ATTRIBUTE);
    return navigateWithoutTransition(navigate, committed);
  }
  activeNavigation = transition;
  moveSharedElementsOnCompositor(transition);
  const settled = transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeNavigation !== transition) return;
      activeNavigation = null;
      runningAnimationSettled = null;
      root.removeAttribute(NAV_TRANSITION_ATTRIBUTE);
    });
  transition.ready.then(
    () => {
      if (activeNavigation === transition) runningAnimationSettled = withTimeout(settled);
    },
    () => {},
  );
  return settled;
}
