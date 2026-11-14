import { NAV_FORWARD_TRANSITION, runNavigationTransition } from '@ratingo/ui/motion';
import { waitForRouteCommit } from './route-commit';
import { rememberScroll } from './scroll-memory';

export function navigateForward(navigate: () => void): Promise<void> {
  rememberScroll();
  return runNavigationTransition([NAV_FORWARD_TRANSITION], navigate, waitForRouteCommit);
}
