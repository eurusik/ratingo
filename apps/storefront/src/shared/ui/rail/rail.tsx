import type { ReactNode, Ref } from 'react';
import { ScrollShadow } from '@heroui/react';

type DesktopLayout = 'peek' | 'grid';

interface RailProps {
  label: string;
  isOrdered?: boolean;
  desktop?: DesktopLayout;
  scrollerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

const SCROLLER_BASE =
  '@container -my-1 snap-x snap-mandatory scroll-px-4 overflow-y-hidden overscroll-x-contain md:my-0';

const SCROLLER_CLASSES: Record<DesktopLayout, string> = {
  peek: `${SCROLLER_BASE} md:mx-[calc(var(--page-gutter)*-1)] md:scroll-px-(--page-gutter)`,
  grid: `${SCROLLER_BASE} md:snap-none md:overflow-visible`,
};

const LIST_CLASSES: Record<DesktopLayout, string> = {
  peek: 'flex w-max gap-3 px-4 py-1 md:px-(--page-gutter) md:py-0 md:[--rail-columns:2] lg:[--rail-columns:3] 2xl:[--rail-columns:4] md:*:w-[calc((100cqw-var(--page-gutter)-var(--rail-columns)*0.75rem)/(var(--rail-columns)+0.4))]',
  grid: 'flex w-max gap-3 px-4 py-1 md:grid md:py-0 md:w-full md:grid-cols-5 md:gap-x-4 md:gap-y-6 md:px-0 xl:grid-cols-10',
};

export function Rail({
  label,
  isOrdered = false,
  desktop = 'peek',
  scrollerRef,
  children,
}: RailProps) {
  const List = isOrdered ? 'ol' : 'ul';

  return (
    <ScrollShadow
      ref={scrollerRef}
      orientation="horizontal"
      hideScrollBar
      className={SCROLLER_CLASSES[desktop]}
    >
      <List aria-label={label} className={LIST_CLASSES[desktop]}>
        {children}
      </List>
    </ScrollShadow>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="shrink-0 snap-start">{children}</li>;
}
