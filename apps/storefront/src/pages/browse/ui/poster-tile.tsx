import { useId, type ReactNode } from 'react';
import Link from 'next/link';
import { Skeleton } from '@heroui/react';
import {
  ExternalRatings,
  MediaPoster,
  ScoreChip,
  type PosterLoadPriority,
} from '@/entities/media';
import { mediaRoute } from '@/shared/config';
import type { GridMedia } from '../model/grid-media';

const TITLE_CLASS =
  'line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm';

interface PosterTileProps {
  media: GridMedia;
  loadPriority?: PosterLoadPriority;
  actions?: ReactNode;
}

export function PosterTile({ media, loadPriority = 'lazy', actions }: PosterTileProps) {
  const titleId = useId();
  const scoreId = useId();

  return (
    <div className="relative flex min-w-0 flex-col gap-1.5 md:gap-2">
      <Link
        href={mediaRoute(media.type, media.slug)}
        aria-labelledby={titleId}
        aria-describedby={media.score === undefined ? undefined : scoreId}
        className="flex flex-col gap-1.5 rounded-xl text-foreground no-underline transition-opacity outline-none hover:opacity-85 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus active:opacity-70 md:gap-2"
      >
        <span className="relative block">
          <MediaPoster
            type={media.type}
            posterUrl={media.posterUrl}
            size="grid"
            loadPriority={loadPriority}
          />
          {media.score === undefined ? null : (
            <span id={scoreId} className="absolute start-1.5 bottom-1.5">
              <ScoreChip score={media.score} tone="overlay" />
            </span>
          )}
        </span>
        <span id={titleId} className={TITLE_CLASS}>
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

export function PosterTileSkeleton() {
  return (
    <div className="flex flex-col gap-1.5 md:gap-2">
      <Skeleton className="aspect-2/3 w-full rounded-xl" />
      <div className={`flex flex-col justify-around ${TITLE_CLASS}`}>
        <Skeleton className="h-[0.8em] w-4/5 rounded-full" />
        <Skeleton className="h-[0.8em] w-1/2 rounded-full" />
      </div>
      <Skeleton className="h-6 w-24 rounded-full" />
    </div>
  );
}
