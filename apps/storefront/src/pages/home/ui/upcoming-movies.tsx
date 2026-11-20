'use client';

import { useRef } from 'react';
import { calendarRouteFor } from '@/shared/config';
import { track } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';
import { Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import type { UpcomingRelease } from '../model/home-feed';
import { trackHomeOpen } from '../model/track-home-open';
import { ReleaseTile } from './release-tile';

const SECTION_ID = 'upcoming-movies';

export function UpcomingMovies({ releases }: { releases: UpcomingRelease[] }) {
  const { dict } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);

  if (releases.length === 0) return null;

  return (
    <section
      aria-labelledby={SECTION_ID}
      className="flex below-fold fold-bleed flex-col gap-2 [--fold-size:18rem] md:[--fold-size:26rem] md:[--fold-bleed-inline:var(--page-gutter)]"
    >
      <SectionHeader
        id={SECTION_ID}
        title={dict.home.upcoming}
        caption={dict.home.upcomingCaption}
        actionHref={calendarRouteFor('movie')}
        actionLabel={dict.home.calendarAction}
        actionAriaLabel={dict.home.calendarLabel.movie}
        onActionClick={() => track('calendar_open', { origin: 'home_upcoming' })}
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={dict.home.upcoming} itemSize="tile" scrollerRef={scroller}>
        {releases.map((release, index) => (
          <RailItem key={release.mediaItemId}>
            <ReleaseTile
              media={{
                mediaItemId: release.mediaItemId,
                title: release.title,
                slug: release.slug,
                type: 'movie',
              }}
              posterUrl={release.posterUrl}
              date={release.releaseDate}
              dateLabel={dict.home.upcomingDate}
              note={dict.release[release.kind]}
              onOpen={() =>
                trackHomeOpen({ origin: 'home_upcoming', mediaType: 'movie', position: index + 1 })
              }
            />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
