'use client';

import { useRef } from 'react';
import { formatReleaseBadge, formatReleaseDate, MediaPoster } from '@/entities/media';
import { calendarRouteFor, mediaRoute } from '@/shared/config';
import { SHARED_ART_SOURCE } from '@/shared/lib';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ForwardLink, Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import type { UpcomingRelease } from '../model/home-feed';

const SECTION_ID = 'upcoming-movies';

function UpcomingTile({ release }: { release: UpcomingRelease }) {
  const { dict, locale } = useTranslation();

  return (
    <ForwardLink
      href={mediaRoute('movie', release.slug)}
      className="flex w-24 flex-col gap-1.5 text-foreground no-underline md:w-full md:gap-2"
    >
      <span {...SHARED_ART_SOURCE} className="relative">
        <MediaPoster type="movie" posterUrl={release.posterUrl} size="rank" />
        <time
          aria-hidden
          dateTime={release.releaseDate.slice(0, 10)}
          className="absolute start-1.5 bottom-1.5 rounded-lg poster-glass px-1.5 py-0.5 text-xs font-extrabold tabular-nums"
        >
          {formatReleaseBadge(locale, release.releaseDate)}
        </time>
      </span>
      <span className="line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm">
        {release.title}
      </span>
      <span className="sr-only">
        {interpolate(dict.home.upcomingDate, {
          date: formatReleaseDate(locale, release.releaseDate),
        })}
      </span>
      <span className="truncate text-xs text-muted">{dict.release[release.kind]}</span>
    </ForwardLink>
  );
}

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
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={dict.home.upcoming} itemSize="tile" scrollerRef={scroller}>
        {releases.map((release) => (
          <RailItem key={release.mediaItemId}>
            <UpcomingTile release={release} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
