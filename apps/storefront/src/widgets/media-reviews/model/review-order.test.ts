import type { Review } from '@/shared/api';
import { withOwnReviewFirst } from './review-order';

const review = (id: string) => ({ id }) as Review;
const ids = (reviews: Review[]) => reviews.map((item) => item.id);

describe('withOwnReviewFirst', () => {
  it('puts the viewer’s review first without repeating it', () => {
    const list = [review('a'), review('mine'), review('b')];
    expect(ids(withOwnReviewFirst(review('mine'), list, new Set()))).toEqual(['mine', 'a', 'b']);
  });

  it('drops hidden reviews, including the viewer’s own', () => {
    const list = [review('a'), review('b')];
    expect(ids(withOwnReviewFirst(review('mine'), list, new Set(['mine', 'b'])))).toEqual(['a']);
    expect(ids(withOwnReviewFirst(null, list, new Set()))).toEqual(['a', 'b']);
  });
});
