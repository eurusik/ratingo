export type RatingVerdict = 'good' | 'mixed' | 'bad';

export type VerdictTone = 'success' | 'warning' | 'danger';

const GOOD_FROM = 7;
const MIXED_FROM = 5.5;

export const VERDICT_TONES: Record<RatingVerdict, VerdictTone> = {
  good: 'success',
  mixed: 'warning',
  bad: 'danger',
};

export function ratingVerdict(score: number): RatingVerdict {
  if (score >= GOOD_FROM) return 'good';
  if (score >= MIXED_FROM) return 'mixed';
  return 'bad';
}
