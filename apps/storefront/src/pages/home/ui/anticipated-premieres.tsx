'use client';

import { useRef } from 'react';
import { calendarRouteFor } from '@/shared/config';
import { track } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import type { PremiereRelease } from '../model/home-feed';
import { trackHomeOpen } from '../model/track-home-open';
import { ReleaseTile } from './release-tile';

const SECTION_ID = 'anticipated-premieres';

export function AnticipatedPremieres({ premieres }: { premieres: PremiereRelease[] }) {
  const { dict } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);

  if (premieres.length === 0) return null;

  return (
    <section
      aria-labelledby={SECTION_ID}
      className="flex below-fold fold-bleed flex-col gap-2 [--fold-size:18rem] md:[--fold-size:26rem] md:[--fold-bleed-inline:var(--page-gutter)]"
    >
      <SectionHeader
        id={SECTION_ID}
        title={dict.home.premieres}
        caption={dict.home.premieresCaption}
        actionHref={calendarRouteFor('show')}
        actionLabel={dict.home.calendarAction}
        actionAriaLabel={dict.home.calendarLabel.show}
        onActionClick={() => track('calendar_open', { origin: 'home_premieres' })}
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={dict.home.premieres} itemSize="tile" scrollerRef={scroller}>
        {premieres.map((premiere, index) => (
          <RailItem key={premiere.mediaItemId}>
            <ReleaseTile
              media={{
                mediaItemId: premiere.mediaItemId,
                title: premiere.title,
                slug: premiere.slug,
                type: 'show',
              }}
              posterUrl={premiere.posterUrl}
              date={premiere.premiereDate}
              dateLabel={dict.home.premiereDate}
              note={dict.home.premiereNote}
              onOpen={() =>
                trackHomeOpen({ origin: 'home_premieres', mediaType: 'show', position: index + 1 })
              }
            />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
