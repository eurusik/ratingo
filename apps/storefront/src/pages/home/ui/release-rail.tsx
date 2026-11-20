'use client';

import { useRef } from 'react';
import { calendarRouteFor } from '@/shared/config';
import { track } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import { trackHomeOpen } from '../model/track-home-open';
import { ReleaseTile, type ReleaseTileMedia } from './release-tile';

interface ReleaseRailItem {
  media: ReleaseTileMedia;
  posterUrl?: string;
  date: string;
  note?: string;
}

interface ReleaseRailProps {
  sectionId: string;
  title: string;
  caption: string;
  dateLabel: string;
  calendarType: 'show' | 'movie';
  origin: 'home_upcoming' | 'home_premieres';
  items: ReleaseRailItem[];
}

export function ReleaseRail({
  sectionId,
  title,
  caption,
  dateLabel,
  calendarType,
  origin,
  items,
}: ReleaseRailProps) {
  const { dict } = useTranslation();
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
        actionHref={calendarRouteFor(calendarType)}
        actionLabel={dict.home.calendarAction}
        actionAriaLabel={dict.home.calendarLabel[calendarType]}
        onActionClick={() => track('calendar_open', { origin })}
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={title} itemSize="tile" scrollerRef={scroller}>
        {items.map((item, index) => (
          <RailItem key={item.media.mediaItemId}>
            <ReleaseTile
              {...item}
              dateLabel={dateLabel}
              onOpen={() =>
                trackHomeOpen({ origin, mediaType: item.media.type, position: index + 1 })
              }
            />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
