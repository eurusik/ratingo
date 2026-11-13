'use client';

import { Chip } from '@heroui/react';
import { Star } from 'lucide-react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { useOwnScore } from '../model/own-score';

export function OwnScoreChip({ mediaItemId }: { mediaItemId: string }) {
  const { dict, locale } = useTranslation();
  const ownScore = useOwnScore(mediaItemId);

  if (ownScore === undefined) return null;

  const score = formatScore(locale, ownScore);

  return (
    <Chip size="sm" variant="soft" color="accent" className="shrink-0 tabular-nums">
      <Star aria-hidden className="size-3 fill-current" />
      <span aria-hidden>{score}</span>
      <span className="sr-only">{interpolate(dict.library.yourScore, { score })}</span>
    </Chip>
  );
}
