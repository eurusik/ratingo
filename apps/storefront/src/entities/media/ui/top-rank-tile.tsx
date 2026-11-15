import { mediaRoute } from '@/shared/config';
import { SHARED_ART_SOURCE } from '@/shared/lib';
import { ForwardLink } from '@/shared/ui';
import type { TrendingMedia } from '../model/media';
import { ExternalRatings } from './external-ratings';
import { MediaPoster } from './media-poster';

interface TopRankTileProps {
  media: TrendingMedia;
  rank: number;
}

export function TopRankTile({ media, rank }: TopRankTileProps) {
  return (
    <ForwardLink
      href={mediaRoute(media.type, media.slug)}
      className="flex w-24 flex-col gap-1.5 text-foreground no-underline md:w-full md:gap-2"
    >
      <span {...SHARED_ART_SOURCE} className="relative">
        <MediaPoster type={media.type} posterUrl={media.posterUrl} size="rank" />
        <span
          aria-hidden
          className="absolute start-0 bottom-0 flex h-7.5 min-w-7.5 items-center justify-center rounded-se-xl rounded-es-xl bg-background px-1.5 text-base font-black tabular-nums md:h-9 md:min-w-9 md:rounded-se-xl md:px-2 md:text-lg"
        >
          {rank}
        </span>
      </span>
      <span className="line-clamp-2 min-h-[2lh] text-[13px] leading-tight font-semibold break-words md:text-sm">
        {media.title}
      </span>
      <span className="min-h-7">
        <ExternalRatings
          imdbRating={media.imdbRating}
          criticsPercent={media.criticsPercent}
          className="flex-wrap"
        />
      </span>
    </ForwardLink>
  );
}
