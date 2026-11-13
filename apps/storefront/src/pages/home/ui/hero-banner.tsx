'use client';

import Link from 'next/link';
import { EventBadge, ExternalRatings, VerdictChip, MediaDetails } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import type { HeroMedia } from '../model/home-feed';

const WIDE_SCREEN = '(min-width: 48rem)';
const BACKDROP_WIDTH = 780;
const BACKDROP_HEIGHT = 439;

function HeroBackdrop({ hero }: { hero: HeroMedia }) {
  const narrowUrl = hero.backdropUrl ?? hero.wideBackdropUrl;
  if (!narrowUrl) return <span className="absolute inset-0 -z-10 bg-surface-secondary" />;

  const wideUrl = hero.wideBackdropUrl ?? narrowUrl;

  return (
    <picture>
      <source media={WIDE_SCREEN} srcSet={wideUrl} />
      <img
        src={narrowUrl}
        alt=""
        width={BACKDROP_WIDTH}
        height={BACKDROP_HEIGHT}
        loading="eager"
        fetchPriority="high"
        className="absolute inset-0 -z-10 size-full bg-surface-secondary object-cover object-top"
      />
    </picture>
  );
}

export function HeroBanner({ hero }: { hero: HeroMedia }) {
  const { dict } = useTranslation();

  return (
    <section
      aria-labelledby="home-hero"
      className="relative isolate flex min-h-108 flex-col justify-end overflow-hidden md:min-h-120 md:rounded-3xl"
    >
      <HeroBackdrop hero={hero} />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/70 to-transparent md:bg-linear-to-r md:from-background/85 md:via-background/45"
      />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-background/70 to-transparent md:hidden"
      />
      <span
        aria-hidden
        className="absolute start-0 top-0 flex h-16 min-w-16 items-center justify-center rounded-ee-3xl bg-background px-3 text-5xl font-black tabular-nums md:h-20 md:min-w-20 md:text-6xl"
      >
        1
      </span>
      <div className="absolute end-4 top-4 z-10 md:end-8 md:top-8">
        <SaveButton media={hero} tone="overlay" />
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-24 pb-5 md:max-w-xl md:px-8 md:pb-8">
        {hero.event ? (
          <div className="flex">
            <EventBadge event={hero.event} />
          </div>
        ) : null}
        <h2
          id="home-hero"
          className="text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl"
        >
          <Link
            href={mediaRoute(hero.type, hero.slug)}
            className="text-foreground no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus md:after:rounded-3xl"
          >
            <span className="sr-only">{dict.home.leadBadge}: </span>
            {hero.title}
          </Link>
        </h2>
        <p className="text-sm text-muted tabular-nums">
          <MediaDetails media={hero} />
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          {hero.verdict ? <VerdictChip verdict={hero.verdict} /> : null}
          <ExternalRatings imdbRating={hero.imdbRating} criticsPercent={hero.criticsPercent} />
          <OwnScoreChip mediaItemId={hero.mediaItemId} />
        </div>
        {hero.overview ? (
          <p className="line-clamp-3 text-sm text-foreground/85 md:text-base">{hero.overview}</p>
        ) : null}
      </div>
    </section>
  );
}
