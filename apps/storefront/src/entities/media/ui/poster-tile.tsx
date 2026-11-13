import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { mediaRoute } from '@/shared/config';
import type { TrendingMedia } from '../model/media';
import { ExternalRatings } from './external-ratings';
import { MediaPoster } from './media-poster';
import { ScoreChip } from './score-chip';

interface PosterTileProps {
  media: TrendingMedia;
  isPriority?: boolean;
  actions?: ReactNode;
}

export function PosterTile({ media, isPriority = false, actions }: PosterTileProps) {
  const titleId = useId();
  const scoreId = useId();
  const hasScore = media.score !== undefined;

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5 md:gap-2">
      <Link
        href={mediaRoute(media.type, media.slug)}
        aria-labelledby={titleId}
        aria-describedby={hasScore ? scoreId : undefined}
        className="flex flex-col gap-1.5 rounded-xl text-foreground no-underline transition-opacity outline-none hover:opacity-85 active:opacity-70 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus md:gap-2"
      >
        <span className="relative block">
          <MediaPoster
            type={media.type}
            posterUrl={media.posterUrl}
            size="grid"
            isPriority={isPriority}
          />
          {media.score === undefined ? null : (
            <span id={scoreId} className="absolute start-1.5 bottom-1.5">
              <ScoreChip score={media.score} tone="overlay" />
            </span>
          )}
        </span>
        <span
          id={titleId}
          className="line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm"
        >
          {media.title}
        </span>
      </Link>
      <div className="flex min-h-6 items-center gap-1.5">
        {media.year === undefined ? null : (
          <span className="hidden text-sm text-muted tabular-nums md:inline">{media.year}</span>
        )}
        <ExternalRatings
          imdbRating={media.imdbRating}
          criticsPercent={media.criticsPercent}
          size="sm"
        />
      </div>
      {actions ? <div className="absolute end-1 top-1 z-10">{actions}</div> : null}
    </div>
  );
}
