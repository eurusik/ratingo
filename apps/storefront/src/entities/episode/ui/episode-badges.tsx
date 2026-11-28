'use client';

import { cn } from '@ratingo/web-core/lib';
import { useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';

const HIGH_RATING = 8.5;

export function TvMazeRating({ rating }: { rating: number }) {
  const { locale } = useTranslation();
  const score = formatScore(locale, rating);

  return (
    <span
      role="img"
      aria-label={`TVMaze ${score}`}
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-default ps-0.5 pe-1.5 text-xs font-extrabold',
        rating >= HIGH_RATING ? 'text-success' : 'text-foreground',
      )}
    >
      <span
        aria-hidden
        className="inline-flex size-3.5 items-center justify-center rounded bg-[#3c948b] text-[9px] font-black text-white"
      >
        TV
      </span>
      {score}
    </span>
  );
}

export function NextBadge() {
  const { dict } = useTranslation();

  return (
    <span className="inline-flex h-5 shrink-0 items-center rounded-full bg-accent-soft px-2 text-[11px] font-extrabold text-accent">
      {dict.episodes.next}
    </span>
  );
}
