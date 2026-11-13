'use client';

import { useRef, type ReactNode, type RefObject } from 'react';
import { TrendingCard, type TrendingMedia } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';

const PRIORITY_CARDS = 2;

interface MediaRailProps {
  id: string;
  title: string;
  items: TrendingMedia[];
  toolbar?: ReactNode;
  scrollerRef?: RefObject<HTMLDivElement | null>;
  isAboveFold?: boolean;
}

export function MediaRail({
  id,
  title,
  items,
  toolbar,
  scrollerRef,
  isAboveFold = false,
}: MediaRailProps) {
  const ownScroller = useRef<HTMLDivElement>(null);
  const scroller = scrollerRef ?? ownScroller;

  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <SectionHeader id={id} title={title} trailing={<RailPager scrollerRef={scroller} />} />
      {toolbar}
      <Rail label={title} scrollerRef={scroller}>
        {items.map((media, index) => (
          <RailItem key={media.mediaItemId}>
            <TrendingCard
              media={media}
              isPriority={isAboveFold && index < PRIORITY_CARDS}
              actions={<SaveButton media={media} tone="overlay" />}
              footer={<OwnScoreChip mediaItemId={media.mediaItemId} />}
            />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
