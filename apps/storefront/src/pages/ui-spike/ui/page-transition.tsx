import { ViewTransition, type ReactNode } from 'react';

const ENTER_BY_DIRECTION = {
  'nav-forward': 'push-enter',
  'nav-back': 'pop-enter',
  default: 'none',
};

const EXIT_BY_DIRECTION = {
  'nav-forward': 'push-exit',
  'nav-back': 'pop-exit',
  default: 'none',
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter={ENTER_BY_DIRECTION} exit={EXIT_BY_DIRECTION} default="none">
      <div className="min-h-dvh bg-background">{children}</div>
    </ViewTransition>
  );
}
