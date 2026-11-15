import Image from 'next/image';
import { cn } from '@ratingo/web-core/lib';
import { tmdbStillUrl } from '@/shared/config';
import type { Episode } from '../model/season';

const SIZES = {
  row: { width: 112, height: 63, className: 'h-[63px] w-28' },
  card: { width: 88, height: 52, className: 'h-13 w-22' },
} as const;

interface EpisodeStillProps {
  episode: Episode;
  badge: string;
  size: keyof typeof SIZES;
  isDimmed?: boolean;
}

export function EpisodeStill({ episode, badge, size, isDimmed = false }: EpisodeStillProps) {
  const { width, height, className } = SIZES[size];
  const src = tmdbStillUrl(episode.stillPath);

  return (
    <span
      aria-hidden
      className={cn('relative shrink-0 overflow-hidden rounded-[10px] bg-default', className)}
    >
      {src ? (
        <Image
          unoptimized
          src={src}
          alt=""
          width={width}
          height={height}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : null}
      {isDimmed ? <span className="absolute inset-0 bg-background/45" /> : null}
      <span className="absolute start-1.5 bottom-1.5 inline-flex h-5 items-center rounded-md bg-black/80 px-1.5 text-xs font-extrabold text-white tabular-nums">
        {badge}
      </span>
    </span>
  );
}
