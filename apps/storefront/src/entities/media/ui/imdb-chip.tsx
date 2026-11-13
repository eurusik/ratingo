import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { RATING_CHIP_CLASSES, type RatingChipSize } from './rating-chip-size';

interface ImdbChipProps {
  rating: number;
  size?: RatingChipSize;
}

export function ImdbChip({ rating, size = 'md' }: ImdbChipProps) {
  const { dict, locale } = useTranslation();
  const score = formatScore(locale, rating);

  return (
    <Chip
      size={size}
      className={`font-extrabold tabular-nums ${size === 'md' ? 'ps-1' : ''} ${RATING_CHIP_CLASSES[size].chip}`}
    >
      <span
        aria-hidden
        translate="no"
        className={`rounded-sm bg-imdb px-1 py-px leading-tight font-black tracking-tight text-black ${RATING_CHIP_CLASSES[size].badge}`}
      >
        IMDb
      </span>
      <span aria-hidden>{score}</span>
      <span className="sr-only">{interpolate(dict.media.imdbLabel, { score })}</span>
    </Chip>
  );
}
