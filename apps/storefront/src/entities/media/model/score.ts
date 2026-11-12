export type RatingVerdict = 'good' | 'mixed' | 'bad';

export type VerdictTone = 'success' | 'warning' | 'danger';

const GOOD_FROM = 7;
const MIXED_FROM = 5.5;
const PERCENT_PER_POINT = 10;

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

export function scoreFromPercent(percent: number | null | undefined): number | undefined {
  if (percent == null || !Number.isFinite(percent) || percent <= 0) return undefined;
  return percent / PERCENT_PER_POINT;
}
