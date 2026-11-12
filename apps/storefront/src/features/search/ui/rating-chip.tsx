import { Chip } from '@heroui/react';
import { interpolate, useTranslation } from '@/shared/i18n';
import { ratingVerdict, type RatingVerdict } from '../model/rating-verdict';

const VERDICT_COLORS: Record<RatingVerdict, 'success' | 'warning' | 'danger'> = {
  good: 'success',
  mixed: 'warning',
  bad: 'danger',
};

export function useRatingLabel(): (rating: number) => string {
  const { dict } = useTranslation();
  return (rating) =>
    interpolate(dict.rating.label, {
      score: rating.toFixed(1),
      verdict: dict.rating.verdict[ratingVerdict(rating)],
    });
}

export function RatingChip({ rating }: { rating: number }) {
  const { dict } = useTranslation();
  const verdict = ratingVerdict(rating);

  return (
    <Chip
      size="sm"
      variant="soft"
      color={VERDICT_COLORS[verdict]}
      className="shrink-0 tabular-nums"
    >
      {`${rating.toFixed(1)} · ${dict.rating.verdict[verdict]}`}
    </Chip>
  );
}
