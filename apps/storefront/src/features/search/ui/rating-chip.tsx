import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ratingVerdict, type RatingVerdict } from '../model/rating-verdict';

const VERDICT_COLORS: Record<RatingVerdict, 'success' | 'warning' | 'danger'> = {
  good: 'success',
  mixed: 'warning',
  bad: 'danger',
};

function useScoreFormat(): (rating: number) => string {
  const { locale } = useTranslation();
  const format = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return (rating) => format.format(rating);
}

export function useRatingLabel(): (rating: number) => string {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  return (rating) =>
    interpolate(dict.rating.label, {
      score: formatScore(rating),
      verdict: dict.rating.verdict[ratingVerdict(rating)],
    });
}

export function RatingChip({ rating }: { rating: number }) {
  const { dict } = useTranslation();
  const formatScore = useScoreFormat();
  const verdict = ratingVerdict(rating);

  return (
    <Chip
      size="sm"
      variant="soft"
      color={VERDICT_COLORS[verdict]}
      className="shrink-0 tabular-nums"
    >
      {`${formatScore(rating)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
