export type RatingVerdict = 'good' | 'mixed' | 'bad';

const GOOD_FROM = 7;
const MIXED_FROM = 5.5;

export function ratingVerdict(rating: number): RatingVerdict {
  if (rating >= GOOD_FROM) return 'good';
  if (rating >= MIXED_FROM) return 'mixed';
  return 'bad';
}
