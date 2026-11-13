import type { ReactNode, Ref } from 'react';
import { ScrollShadow } from '@heroui/react';

type RailItemSize = 'card' | 'tile';

interface RailProps {
  label: string;
  isOrdered?: boolean;
  itemSize?: RailItemSize;
  scrollerRef?: Ref<HTMLDivElement>;
  children: ReactNode;
}

const SCROLLER_CLASS =
  '@container -my-4 snap-x snap-mandatory scroll-px-4 overflow-y-hidden overscroll-x-contain md:mx-[calc(var(--page-gutter)*-1)] md:scroll-px-(--page-gutter)';

const LIST_BASE =
  'flex w-max gap-3 px-4 py-4 md:px-(--page-gutter) md:*:w-[calc((100cqw-var(--page-gutter)-var(--rail-columns)*0.75rem)/(var(--rail-columns)+0.4))]';

const COLUMNS_BY_SIZE: Record<RailItemSize, string> = {
  card: 'md:[--rail-columns:2] lg:[--rail-columns:3] 2xl:[--rail-columns:4]',
  tile: 'md:[--rail-columns:5] lg:[--rail-columns:6] xl:[--rail-columns:7] 2xl:[--rail-columns:8]',
};

export function Rail({
  label,
  isOrdered = false,
  itemSize = 'card',
  scrollerRef,
  children,
}: RailProps) {
  const List = isOrdered ? 'ol' : 'ul';

  return (
    <ScrollShadow
      ref={scrollerRef}
      orientation="horizontal"
      hideScrollBar
      className={SCROLLER_CLASS}
    >
      <List aria-label={label} className={`${LIST_BASE} ${COLUMNS_BY_SIZE[itemSize]}`}>
        {children}
      </List>
    </ScrollShadow>
  );
}

export function RailItem({ children }: { children: ReactNode }) {
  return <li className="shrink-0 snap-start">{children}</li>;
}
