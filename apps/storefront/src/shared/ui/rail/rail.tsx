import type { ReactNode } from 'react';
import { ScrollShadow } from '@heroui/react';

interface RailProps {
  label: string;
  isOrdered?: boolean;
  children: ReactNode;
}

const LIST_CLASS = 'flex w-max gap-3 px-4 md:px-(--page-gutter)';

export function Rail({ label, isOrdered = false, children }: RailProps) {
  return (
    <ScrollShadow
      orientation="horizontal"
      hideScrollBar
      className="snap-x snap-mandatory scroll-px-4 overflow-y-hidden overscroll-x-contain md:mx-[calc(var(--page-gutter)*-1)] md:scroll-px-(--page-gutter)"
    >
      {isOrdered ? (
        <ol aria-label={label} className={LIST_CLASS}>
          {children}
        </ol>
      ) : (
        <ul aria-label={label} className={LIST_CLASS}>
          {children}
        </ul>
      )}
    </ScrollShadow>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="shrink-0 snap-start">{children}</li>;
}
