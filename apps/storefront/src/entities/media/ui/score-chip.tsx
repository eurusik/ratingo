import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatScore } from '@/shared/lib';
import { ratingVerdict, VERDICT_TONES } from '../model/score';

export function useScoreLabel(): (score: number) => string {
  const { dict, locale } = useTranslation();
  return (score) =>
    interpolate(dict.rating.label, {
      score: formatScore(locale, score),
      verdict: dict.rating.verdict[ratingVerdict(score)],
    });
}

export function ScoreChip({ score }: { score: number }) {
  const { dict, locale } = useTranslation();
  const verdict = ratingVerdict(score);

  return (
    <Chip
      size="sm"
      variant="soft"
      color={VERDICT_TONES[verdict]}
      className="shrink-0 font-extrabold tabular-nums"
    >
      {`${formatScore(locale, score)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
