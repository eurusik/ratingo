import { NAV_FORWARD_TRANSITION, runNavigationTransition } from '@ratingo/ui/motion';
import { waitForRouteCommit } from './route-commit';
import { rememberScroll } from './scroll-memory';

interface ForwardNavigationOptions {
  keepScroll?: boolean;
}

async function commitAtPageTop(): Promise<void> {
  await waitForRouteCommit();
  window.scrollTo(0, 0);
}

export function navigateForward(
  navigate: () => void,
  { keepScroll = false }: ForwardNavigationOptions = {},
): Promise<void> {
  rememberScroll();
  return runNavigationTransition(
    [NAV_FORWARD_TRANSITION],
    navigate,
    keepScroll ? waitForRouteCommit : commitAtPageTop,
  );
}
