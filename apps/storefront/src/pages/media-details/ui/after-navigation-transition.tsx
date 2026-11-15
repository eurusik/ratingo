'use client';

import { use, type ReactNode } from 'react';
import { runningNavigationAnimation } from '@ratingo/ui/motion';

export function AfterNavigationTransition({ children }: { children: ReactNode }) {
  const runningAnimation = runningNavigationAnimation();
  if (runningAnimation) use(runningAnimation);
  return children;
}
