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
      <div data-page-transition className="flex-1 bg-background">
        {children}
      </div>
    </ViewTransition>
  );
}

export function ContentTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition update="content-fade" default="none">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
