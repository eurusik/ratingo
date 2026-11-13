import { ProgressCircle } from '@heroui/react';
import { VERDICT_TONES, type RatingVerdict } from '@/entities/media';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';

const SCORE_TO_PERCENT = 10;

export function ScoreRing({ score, verdict }: { score: number; verdict: RatingVerdict }) {
  const { dict, locale } = useTranslation();
  const shown = formatScore(locale, score);

  return (
    <ProgressCircle
      aria-label={interpolate(dict.details.ratings.score, { score: shown })}
      value={score * SCORE_TO_PERCENT}
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
        {shown}
      </span>
    </ProgressCircle>
  );
}
