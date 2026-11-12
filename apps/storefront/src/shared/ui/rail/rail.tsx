import type { ReactNode } from 'react';
import { ScrollShadow } from '@heroui/react';

type DesktopLayout = 'scroll' | 'grid';

interface RailProps {
  label: string;
  isOrdered?: boolean;
  desktop?: DesktopLayout;
  children: ReactNode;
}

const SCROLLER_CLASSES: Record<DesktopLayout, string> = {
  scroll:
    'snap-x snap-mandatory scroll-px-4 overflow-y-hidden overscroll-x-contain md:mx-[calc(var(--page-gutter)*-1)] md:scroll-px-(--page-gutter)',
  grid: 'snap-x snap-mandatory scroll-px-4 overflow-y-hidden overscroll-x-contain md:snap-none md:overflow-visible',
};

const LIST_CLASSES: Record<DesktopLayout, string> = {
  scroll: 'flex w-max gap-3 px-4 md:px-(--page-gutter)',
  grid: 'flex w-max gap-3 px-4 md:grid md:w-full md:grid-cols-5 md:gap-x-4 md:gap-y-6 md:px-0 xl:grid-cols-10',
};

export function Rail({ label, isOrdered = false, desktop = 'scroll', children }: RailProps) {
  const List = isOrdered ? 'ol' : 'ul';

  return (
    <ScrollShadow orientation="horizontal" hideScrollBar className={SCROLLER_CLASSES[desktop]}>
      <List aria-label={label} className={LIST_CLASSES[desktop]}>
        {children}
      </List>
    </ScrollShadow>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="shrink-0 snap-start">{children}</li>;
}
