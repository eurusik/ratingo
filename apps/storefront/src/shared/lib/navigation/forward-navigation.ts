import { NAV_FORWARD_TRANSITION, runNavigationTransition } from '@ratingo/ui/motion';
import { waitForRouteCommit } from './route-commit';

export function navigateForward(navigate: () => void): Promise<void> {
  return runNavigationTransition([NAV_FORWARD_TRANSITION], navigate, waitForRouteCommit);
}
