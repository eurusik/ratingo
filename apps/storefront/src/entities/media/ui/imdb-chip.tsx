import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';

export function ImdbChip({ rating }: { rating: number }) {
  const { dict, locale } = useTranslation();
  const score = formatScore(locale, rating);

  return (
    <Chip
      size="md"
      className="gap-1.5 bg-black/80 ps-1 text-xs font-extrabold text-white tabular-nums"
    >
      <span
        aria-hidden
        translate="no"
        className="rounded-sm bg-imdb px-1 py-px text-[11px] leading-tight font-black tracking-tight text-black"
      >
        IMDb
      </span>
      <span aria-hidden>{score}</span>
      <span className="sr-only">{interpolate(dict.media.imdbLabel, { score })}</span>
    </Chip>
  );
}
