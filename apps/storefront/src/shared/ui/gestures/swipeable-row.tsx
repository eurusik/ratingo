'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { attachSwipeReveal } from './swipe-reveal';

interface SwipeableRowProps {
  actions: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SwipeableRow({ actions, children, className }: SwipeableRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const row = rowRef.current;
    const content = contentRef.current;
    const actions = actionsRef.current;
    if (!row || !content || !actions) return;
    return attachSwipeReveal({ row, content, actions });
  }, []);

  return (
    <div ref={rowRef} className={`group relative overflow-hidden ${className ?? ''}`}>
      <div
        ref={actionsRef}
        aria-hidden
        className="invisible absolute inset-y-0 right-0 flex [transition:visibility_0s_linear_0.4s] group-data-[dragging]:visible group-data-[dragging]:[transition:none] group-data-[open]:visible group-data-[open]:[transition:none]"
      >
        {actions}
      </div>
      <div
        ref={contentRef}
        className="relative touch-pan-y bg-(--swipeable-row-surface,var(--background)) group-data-[dragging]:select-none"
      >
        {children}
      </div>
    </div>
  );
}
