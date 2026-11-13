export const NAV_FORWARD_TRANSITION = 'nav-forward';
export const NAV_BACK_TRANSITION = 'nav-back';

const PROGRAMMATIC_BACK_TTL_MS = 2000;
const NAVIGATION_TIMEOUT_MS = 1000;

type StartViewTransition = (options: {
  update: () => Promise<void>;
  types: string[];
}) => ViewTransition;

let activeNavigation: ViewTransition | null = null;
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

export function installNavigationTransitionGuard(): void {
  if (isGuardInstalled || typeof document.startViewTransition !== 'function') return;
  isGuardInstalled = true;
  const original = document.startViewTransition.bind(document);

  document.startViewTransition = ((...args: Parameters<typeof original>) => {
    if (activeNavigation) {
      throw new DOMException('Navigation view transition is in progress', 'InvalidStateError');
    }
    return original(...args);
  }) as typeof document.startViewTransition;
}

export function runNavigationTransition(
  types: string[],
  navigate: () => void,
  committed: () => Promise<void>,
): Promise<void> {
  if (!canAnimateNavigation()) {
    navigate();
    return Promise.resolve();
  }

  const start = document.startViewTransition.bind(document) as unknown as StartViewTransition;
  let transition: ViewTransition;
  try {
    transition = start({
      types,
      update: () => {
        navigate();
        return withTimeout(committed());
      },
    });
  } catch {
    navigate();
    return Promise.resolve();
  }
  activeNavigation = transition;
  transition.ready.catch(() => {});
  return transition.finished
    .catch(() => {})
    .finally(() => {
      if (activeNavigation === transition) activeNavigation = null;
    });
}
