'use client';

import { ProgressCircle } from '@heroui/react';
import { VERDICT_TONES, type RatingVerdict } from '@/entities/media';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore, percentFromScore } from '@/shared/lib';

export function ScoreRing({ score, verdict }: { score: number; verdict: RatingVerdict }) {
  const { dict, locale } = useTranslation();
  const label = interpolate(dict.details.ratings.score, { score: formatScore(locale, score) });

  return (
    <ProgressCircle
      aria-label={label}
      valueLabel={label}
      value={percentFromScore(score)}
      color={VERDICT_TONES[verdict]}
      className="relative size-18 shrink-0 md:size-19"
    >
      <ProgressCircle.Track viewBox="0 0 36 36" className="size-full">
        <ProgressCircle.TrackCircle cx={18} cy={18} r={16} strokeWidth={3} />
        <ProgressCircle.FillCircle cx={18} cy={18} r={16} strokeWidth={3} strokeLinecap="round" />
      </ProgressCircle.Track>
      <span
        aria-hidden
        className="absolute inset-0 flex items-center justify-center text-2xl font-extrabold tabular-nums"
      >
        {formatScore(locale, score)}
      </span>
    </ProgressCircle>
  );
}
