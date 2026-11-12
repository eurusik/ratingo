import Link from 'next/link';
import { mediaRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import type { TrendingMedia } from '../model/media';
import { MediaPoster } from './media-poster';

interface TopRankTileProps {
  media: TrendingMedia;
  rank: number;
}

export function TopRankTile({ media, rank }: TopRankTileProps) {
  const { dict } = useTranslation();

  return (
    <Link
      href={mediaRoute(media.type, media.slug)}
      className="flex w-19 flex-col gap-1.25 text-foreground no-underline"
    >
      <span className="relative">
        <MediaPoster type={media.type} posterUrl={media.posterUrl} size="rank" />
        <span
          aria-hidden
          className="absolute start-0 bottom-0 flex h-6.5 min-w-6.5 items-center justify-center rounded-se-[10px] rounded-es-xl bg-background px-1.5 text-sm font-black tabular-nums"
        >
          {rank}
        </span>
      </span>
      <span className="line-clamp-2 min-h-[2lh] text-xs leading-tight font-semibold break-words">
        <span className="sr-only">{interpolate(dict.media.rank, { rank })} </span>
        {media.title}
      </span>
    </Link>
  );
}
