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

type ScoreChipTone = 'surface' | 'overlay';

const TONE_CLASSES: Record<ScoreChipTone, string> = {
  surface: '',
  overlay: 'bg-black/80 backdrop-blur-md',
};

interface ScoreChipProps {
  score: number;
  tone?: ScoreChipTone;
}

export function ScoreChip({ score, tone = 'surface' }: ScoreChipProps) {
  const { dict, locale } = useTranslation();
  const verdict = ratingVerdict(score);

  return (
    <Chip
      size="sm"
      variant={tone === 'overlay' ? 'tertiary' : 'soft'}
      color={VERDICT_TONES[verdict]}
      className={`shrink-0 font-extrabold tabular-nums ${TONE_CLASSES[tone]}`}
    >
      {`${formatScore(locale, score)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
