'use client';

import { useCallback, useEffect, useState, type RefObject } from 'react';
import { Button } from '@heroui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from '@/shared/i18n';

type Direction = -1 | 1;

const PAGE_SHARE = 0.85;
const EDGE_TOLERANCE_PX = 2;

interface ScrollEdges {
  atStart: boolean;
  atEnd: boolean;
}

function readEdges(scroller: HTMLElement): ScrollEdges {
  const maxScroll = scroller.scrollWidth - scroller.clientWidth;
  return {
    atStart: scroller.scrollLeft <= EDGE_TOLERANCE_PX,
    atEnd: scroller.scrollLeft >= maxScroll - EDGE_TOLERANCE_PX,
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useScrollEdges(scrollerRef: RefObject<HTMLElement | null>): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>({ atStart: true, atEnd: true });

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const update = () => {
      const next = readEdges(scroller);
      setEdges((current) =>
        current.atStart === next.atStart && current.atEnd === next.atEnd ? current : next,
      );
    };
    update();
    scroller.addEventListener('scroll', update, { passive: true });
    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(scroller);
    if (scroller.firstElementChild) resizeObserver.observe(scroller.firstElementChild);
    return () => {
      scroller.removeEventListener('scroll', update);
      resizeObserver.disconnect();
    };
  }, [scrollerRef]);

  return edges;
}

export function RailPager({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const { dict } = useTranslation();
  const { atStart, atEnd } = useScrollEdges(scrollerRef);

  const page = useCallback(
    (direction: Direction) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollBy({
        left: direction * scroller.clientWidth * PAGE_SHARE,
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    },
    [scrollerRef],
  );

  if (atStart && atEnd) return null;

  const buttons = [
    { direction: -1, label: dict.rail.previous, isDisabled: atStart, Icon: ChevronLeft },
    { direction: 1, label: dict.rail.next, isDisabled: atEnd, Icon: ChevronRight },
  ] as const;

  return (
    <div className="hidden gap-1.5 md:pointer-fine:flex">
      {buttons.map(({ direction, label, isDisabled, Icon }) => (
        <Button
          key={direction}
          isIconOnly
          size="sm"
          variant="tertiary"
          className="rounded-full"
          aria-label={label}
          isDisabled={isDisabled}
          onPress={() => page(direction)}
        >
          <Icon aria-hidden className="size-4" />
        </Button>
      ))}
    </div>
  );
}
