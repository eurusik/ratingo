'use client';

import { Card } from '@heroui/react';
import {
  CardGlow,
  ExternalRatings,
  MediaPoster,
  VerdictChip,
  MediaDetails,
  type TrendingMedia,
} from '@/entities/media';
import { SaveButton } from '@/features/save-to-library';
import { mediaRoute } from '@/shared/config';
import { SHARED_ART_SCOPE, SHARED_ART_SOURCE } from '@/shared/lib';
import { useTranslation } from '@/shared/i18n';
import { ForwardLink, SectionHeader } from '@/shared/ui';

const SECTION_ID = 'top-picks';

function TopThreeCard({ media, rank }: { media: TrendingMedia; rank: number }) {
  return (
    <Card
      {...SHARED_ART_SCOPE}
      className="relative isolate flex-row items-center gap-3 overflow-hidden rounded-2xl p-3"
    >
      <CardGlow imageUrl={media.posterUrl} />
      <span
        aria-hidden
        className="w-7 shrink-0 text-center text-3xl font-black text-muted tabular-nums"
      >
        {rank}
      </span>
      <span {...SHARED_ART_SOURCE} className="shrink-0">
        <MediaPoster type={media.type} posterUrl={media.posterUrl} size="list" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Card.Title className="line-clamp-2 text-base leading-tight font-extrabold">
          <ForwardLink
            href={mediaRoute(media.type, media.slug)}
            className="text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-focus"
          >
            {media.title}
          </ForwardLink>
        </Card.Title>
        <Card.Description className="text-sm tabular-nums">
          <MediaDetails media={media} />
        </Card.Description>
        <div className="flex min-h-7 items-center gap-1.5">
          {media.verdict ? <VerdictChip verdict={media.verdict} /> : null}
          <ExternalRatings imdbRating={media.imdbRating} />
        </div>
      </div>
      <div className="relative z-10 shrink-0 self-start">
        <SaveButton media={media} />
      </div>
    </Card>
  );
}

interface TopThreeProps {
  items: TrendingMedia[];
  firstRank: number;
}

export function TopThree({ items, firstRank }: TopThreeProps) {
  const { dict } = useTranslation();
  const title = dict.home.picks;

  if (items.length === 0) return null;

  return (
    <section aria-labelledby={SECTION_ID} className="flex flex-col gap-2">
      <SectionHeader id={SECTION_ID} title={title} />
      <ol
        aria-label={title}
        start={firstRank}
        className="grid gap-2 px-4 md:grid-cols-3 md:gap-3 md:px-0"
      >
        {items.map((media, index) => (
          <li key={media.mediaItemId}>
            <TopThreeCard media={media} rank={firstRank + index} />
          </li>
        ))}
      </ol>
    </section>
  );
}
