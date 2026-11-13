'use client';

import { EventBadge, ExternalRatings, VerdictChip, MediaDetails } from '@/entities/media';
import { OwnScoreChip } from '@/entities/library';
import { SaveButton } from '@/features/save-to-library';
import { mediaRoute } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { BackdropPicture, ForwardLink } from '@/shared/ui';
import type { HeroMedia } from '../model/home-feed';
import { HERO_FRAME_CLASS } from './hero-frame';
import { RankCorner } from './rank-corner';

function HeroBackdrop({ hero }: { hero: HeroMedia }) {
  const narrowUrl = hero.backdropUrl ?? hero.wideBackdropUrl;
  if (!narrowUrl) return <span className="absolute inset-0 -z-10 bg-surface-secondary" />;

  const wideUrl = hero.wideBackdropUrl ?? narrowUrl;

  return (
    <>
      <BackdropPicture
        url={narrowUrl}
        wideUrl={wideUrl}
        className="-z-10 bg-surface-secondary object-top"
        isPriority
      />
      <span
        aria-hidden
        className="absolute inset-0 -z-10 overflow-hidden [mask-image:linear-gradient(to_top,black_30%,transparent_65%)] md:[mask-image:linear-gradient(to_right,black_25%,transparent_55%)]"
      >
        <BackdropPicture
          url={narrowUrl}
          wideUrl={wideUrl}
          className="scale-110 object-top blur-2xl"
        />
      </span>
    </>
  );
}

export function HeroBanner({ hero }: { hero: HeroMedia }) {
  const { dict } = useTranslation();

  return (
    <section aria-labelledby="home-hero" className={HERO_FRAME_CLASS}>
      <HeroBackdrop hero={hero} />
      <span aria-hidden className="hero-fade md:hero-fade-side absolute inset-0 -z-10" />
      <span
        aria-hidden
        className="absolute inset-x-0 top-0 -z-10 h-32 bg-linear-to-b from-background/70 to-transparent md:hidden"
      />
      <RankCorner />
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
          <ForwardLink
            href={mediaRoute(hero.type, hero.slug)}
            className="text-foreground no-underline outline-none after:absolute after:inset-0 after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus md:after:rounded-3xl"
          >
            <span className="sr-only">{dict.home.leadBadge}: </span>
            {hero.title}
          </ForwardLink>
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
