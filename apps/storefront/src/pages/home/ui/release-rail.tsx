'use client';

import { useRef, type ReactNode } from 'react';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { trackHomeOpen } from '../model/track-home-open';
import { ReleaseTile, type ReleaseNote, type ReleaseTileMedia } from './release-tile';

interface ReleaseRailItem {
  media: ReleaseTileMedia;
  posterUrl?: string;
  date: string;
  note?: ReleaseNote;
}

interface ReleaseRailProps {
  sectionId: string;
  title: string;
  caption: string;
  dateLabel: string;
  origin: 'home_upcoming' | 'home_premieres';
  items: ReleaseRailItem[];
  endItem?: ReactNode;
}

export function ReleaseRail({
  sectionId,
  title,
  caption,
  dateLabel,
  origin,
  items,
  endItem,
}: ReleaseRailProps) {
  const scroller = useRef<HTMLDivElement>(null);

  return (
    <section
      aria-labelledby={sectionId}
      className="flex below-fold fold-bleed flex-col gap-2 [--fold-size:18rem] md:[--fold-size:26rem] md:[--fold-bleed-inline:var(--page-gutter)]"
    >
      <SectionHeader
        id={sectionId}
        title={title}
        caption={caption}
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={title} itemSize="tile" scrollerRef={scroller}>
        {items.map((item, index) => (
          <RailItem key={item.media.mediaItemId}>
            <ReleaseTile
              {...item}
              dateLabel={dateLabel}
              origin={origin}
              onOpen={() =>
                trackHomeOpen({ origin, mediaType: item.media.type, position: index + 1 })
              }
            />
          </RailItem>
        ))}
        {endItem ? <RailItem>{endItem}</RailItem> : null}
      </Rail>
    </section>
  );
}
