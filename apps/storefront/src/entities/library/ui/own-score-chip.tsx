'use client';

import { Chip } from '@heroui/react';
import { Star } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { useOwnRating } from '../model/own-rating';

const PERCENT_PER_POINT = 10;

export function OwnScoreChip({ mediaItemId }: { mediaItemId: string }) {
  const { dict, locale } = useTranslation();
  const rating = useOwnRating(mediaItemId);

  if (rating === undefined) return null;

  const score = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    rating / PERCENT_PER_POINT,
  );

  return (
    <Chip size="sm" variant="soft" color="accent" className="shrink-0 tabular-nums">
      <Star aria-hidden className="size-3 fill-current" />
      <span aria-hidden>{score}</span>
      <span className="sr-only">{interpolate(dict.library.yourScore, { score })}</span>
    </Chip>
  );
}
