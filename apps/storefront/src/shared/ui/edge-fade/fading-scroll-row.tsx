'use client';

import type { ReactNode } from 'react';
import { EdgeFade } from './edge-fade';
import { useHorizontalScroller } from './horizontal-scroller';

interface FadingScrollRowProps {
  activeKey: string;
  contentKey: string;
  activeSelector?: string;
  children: ReactNode;
}

export function FadingScrollRow({
  activeKey,
  contentKey,
  activeSelector,
  children,
}: FadingScrollRowProps) {
  const { ref, edges } = useHorizontalScroller<HTMLDivElement>({
    activeKey: `${activeKey}:${contentKey}`,
    contentKey,
    activeSelector,
  });

  return (
    <div className="relative -mx-4 md:mx-0">
      <div
        ref={ref}
        className="overflow-x-auto scroll-px-10 px-4 [scrollbar-width:none] md:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <EdgeFade side="start" isVisible={edges.hasMoreBefore} />
      <EdgeFade side="end" isVisible={edges.hasMoreAfter} />
    </div>
  );
}
