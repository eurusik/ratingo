import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ratingVerdict, VERDICT_TONES } from '../model/score';

function useScoreFormat(): (score: number) => string {
  const { locale } = useTranslation();
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (score) => format.format(score);
}

export function useScoreLabel(): (score: number) => string {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  return (score) =>
    interpolate(dict.rating.label, {
      score: formatScore(score),
      verdict: dict.rating.verdict[ratingVerdict(score)],
    });
}

interface ScoreChipProps {
  score: number;
  size?: 'sm' | 'md';
}

export function ScoreChip({ score, size = 'sm' }: ScoreChipProps) {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  const verdict = ratingVerdict(score);

  return (
    <Chip
      size={size}
      variant="soft"
      color={VERDICT_TONES[verdict]}
      className="shrink-0 font-extrabold tabular-nums"
    >
      {`${formatScore(score)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
