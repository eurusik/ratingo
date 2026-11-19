'use client';

import { useRef } from 'react';
import { episodeCode } from '@/entities/episode';
import { MediaPoster } from '@/entities/media';
import { SERVICE_TIME_ZONE, calendarRouteFor, mediaRoute } from '@/shared/config';
import { SHARED_ART_SOURCE, track } from '@/shared/lib';
import { interpolate, useTranslation, type Locale } from '@/shared/i18n';
import { ForwardLink, Rail, RailItem, RailPager, SectionHeader } from '@/shared/ui';
import type { EpisodeRelease } from '../model/home-feed';

const airDateFormats = new Map<Locale, Intl.DateTimeFormat>();

function formatAirDate(locale: Locale, airedAt: string): string {
  let format = airDateFormats.get(locale);
  if (!format) {
    format = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      timeZone: SERVICE_TIME_ZONE,
    });
    airDateFormats.set(locale, format);
  }
  const date = new Date(airedAt);
  return Number.isNaN(date.getTime()) ? '' : format.format(date);
}

function EpisodeTile({ release }: { release: EpisodeRelease }) {
  const { dict, locale } = useTranslation();
  const numbers = { season: release.season, episode: release.episode };

  return (
    <ForwardLink
      href={mediaRoute('show', release.slug)}
      className="flex w-24 flex-col gap-1.5 text-foreground no-underline md:w-full md:gap-2"
    >
      <span {...SHARED_ART_SOURCE} className="relative">
        <MediaPoster type="show" posterUrl={release.posterUrl} size="rank" />
        <span
          aria-hidden
          className="absolute start-1.5 bottom-1.5 rounded-lg poster-glass px-1.5 py-0.5 text-xs font-extrabold tabular-nums"
        >
          {episodeCode({ seasonNumber: release.season, number: release.episode }, dict)}
        </span>
      </span>
      <span className="line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm">
        {release.showTitle}
      </span>
      <span className="sr-only">{interpolate(dict.home.episodeLabel, numbers)}</span>
      <time dateTime={release.airedAt} className="text-xs text-muted tabular-nums">
        {formatAirDate(locale, release.airedAt)}
      </time>
    </ForwardLink>
  );
}

export function NewEpisodes({ releases }: { releases: EpisodeRelease[] }) {
  const { dict } = useTranslation();
  const scroller = useRef<HTMLDivElement>(null);

  if (releases.length === 0) return null;

  return (
    <section
      aria-labelledby="new-episodes"
      className="flex below-fold fold-bleed flex-col gap-2 [--fold-size:17rem] md:[--fold-size:25rem] md:[--fold-bleed-inline:var(--page-gutter)]"
    >
      <SectionHeader
        id="new-episodes"
        title={dict.home.newEpisodes}
        caption={dict.home.newEpisodesCaption}
        actionHref={calendarRouteFor('show')}
        actionLabel={dict.home.calendarAction}
        actionAriaLabel={dict.home.calendarLabel.show}
        onActionClick={() => track('calendar_open', { origin: 'home_episodes' })}
        trailing={<RailPager scrollerRef={scroller} />}
      />
      <Rail label={dict.home.newEpisodes} itemSize="tile" scrollerRef={scroller}>
        {releases.map((release) => (
          <RailItem key={release.mediaItemId}>
            <EpisodeTile release={release} />
          </RailItem>
        ))}
      </Rail>
    </section>
  );
}
