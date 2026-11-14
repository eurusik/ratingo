import type { InfiniteData } from '@tanstack/react-query';
import type { Review, ReviewPage } from '@/shared/api';
import { updateCachedReview } from './review-cache';

const review = (id: string, likesCount = 0) => ({ id, likesCount }) as Review;
const liked = (item: Review) => ({ ...item, likesCount: item.likesCount + 1 });

describe('updateCachedReview', () => {
  it('updates the matching review in a single page', () => {
    const page: ReviewPage = { reviews: [review('a'), review('b')], total: 2 };
    expect(updateCachedReview(page, 'b', liked)).toEqual({
      reviews: [review('a'), review('b', 1)],
      total: 2,
    });
  });

  it('updates the matching review across infinite pages', () => {
    const pages: InfiniteData<ReviewPage> = {
      pages: [
        { reviews: [review('a')], total: 2 },
        { reviews: [review('b')], total: 2 },
      ],
      pageParams: [0, 1],
    };
    const updated = updateCachedReview(pages, 'b', liked) as InfiniteData<ReviewPage>;
    expect(updated.pages[1]?.reviews[0]?.likesCount).toBe(1);
    expect(updated.pages[0]?.reviews[0]).toEqual(review('a'));
  });

  it('updates the viewer’s own review and leaves other data alone', () => {
    expect(updateCachedReview(review('mine'), 'mine', liked)).toEqual(review('mine', 1));
    expect(updateCachedReview(review('mine'), 'other', liked)).toEqual(review('mine'));
    expect(updateCachedReview(null, 'mine', liked)).toBeNull();
    expect(updateCachedReview(undefined, 'mine', liked)).toBeUndefined();
  });
});
