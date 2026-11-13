import { ViewTransition, type ReactNode } from 'react';
import './content-transition.css';

export function ContentTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition update="content-fade" default="none">
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}
