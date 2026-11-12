import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ratingVerdict, VERDICT_TONES } from '../model/score';
import { useScoreFormat } from './score-format';

export function useScoreLabel(): (score: number) => string {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  return (score) =>
    interpolate(dict.rating.label, {
      score: formatScore(score),
      verdict: dict.rating.verdict[ratingVerdict(score)],
    });
}

export function ScoreChip({ score }: { score: number }) {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  const verdict = ratingVerdict(score);

  return (
    <Chip
      size="sm"
      variant="soft"
      color={VERDICT_TONES[verdict]}
      className="shrink-0 font-extrabold tabular-nums"
    >
      {`${formatScore(score)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
