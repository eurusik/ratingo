'use client';

import Link from 'next/link';
import { getImageProps } from 'next/image';
import { Chip } from '@heroui/react';
import { EventBadge, ExternalRatings, VerdictChip } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import type { HeroMedia } from '../model/home-feed';

const WIDE_SCREEN = '(min-width: 48rem)';

function HeroBackdrop({ hero }: { hero: HeroMedia }) {
  const narrowUrl = hero.backdropUrl ?? hero.wideBackdropUrl;
  if (!narrowUrl) return <span className="absolute inset-0 -z-10 bg-surface-secondary" />;

  const common = { alt: '', unoptimized: true, loading: 'eager', fetchPriority: 'high' } as const;
  const { props: narrow } = getImageProps({ ...common, src: narrowUrl, width: 780, height: 439 });
  const wideUrl = hero.wideBackdropUrl ?? narrowUrl;

  return (
    <picture>
      <source media={WIDE_SCREEN} srcSet={wideUrl} />
      <img
        {...narrow}
        alt=""
        className="absolute inset-0 -z-10 size-full bg-surface-secondary object-cover object-top"
      />
    </picture>
  );
}

export function HeroBanner({ hero }: { hero: HeroMedia }) {
  const { dict } = useTranslation();
  const details = [dict.media.type[hero.type], hero.year].filter(Boolean).join(' · ');

  return (
    <section
      aria-labelledby="home-hero"
      className="relative isolate flex min-h-108 flex-col justify-end overflow-hidden md:min-h-120 md:rounded-3xl"
    >
      <HeroBackdrop hero={hero} />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-background via-background/70 to-transparent md:bg-linear-to-r md:via-background/50"
      />
      <ExternalRatings
        imdbRating={hero.imdbRating}
        criticsPercent={hero.criticsPercent}
        className="absolute start-4 top-4 md:start-8 md:top-8"
      />
      <div className="absolute end-4 top-4 z-10 md:end-8 md:top-8">
        <SaveButton media={hero} tone="overlay" />
      </div>
      <div className="flex flex-col gap-2.5 px-4 pt-24 pb-5 md:max-w-xl md:px-8 md:pb-8">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip size="sm" color="accent" variant="primary" className="font-extrabold">
            {dict.home.leadBadge}
          </Chip>
          {hero.event ? <EventBadge event={hero.event} /> : null}
        </div>
        <h2
          id="home-hero"
          className="text-3xl leading-tight font-extrabold tracking-tight text-balance md:text-5xl"
        >
          <Link
            href={mediaRoute(hero.type, hero.slug)}
            className="text-foreground no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus md:after:rounded-3xl"
          >
            {hero.title}
          </Link>
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted tabular-nums">
          <span>{details}</span>
          {hero.verdict ? <VerdictChip verdict={hero.verdict} /> : null}
          <OwnScoreChip mediaItemId={hero.mediaItemId} />
        </div>
        {hero.overview ? (
          <p className="line-clamp-3 text-sm text-foreground/85 md:text-base">{hero.overview}</p>
        ) : null}
      </div>
    </section>
  );
}
