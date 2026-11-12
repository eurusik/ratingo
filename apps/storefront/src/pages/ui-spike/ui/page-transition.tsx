import { ViewTransition, type ReactNode } from 'react';

const DIRECTIONAL_TRANSITION = {
  'nav-forward': 'nav-forward',
  'nav-back': 'nav-back',
  default: 'none',
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={DIRECTIONAL_TRANSITION} exit={DIRECTIONAL_TRANSITION} default="none">
      {children}
    </ViewTransition>
  );
}
