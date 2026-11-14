import fc from 'fast-check';
import type { Review, VoteType } from '@/shared/api';
import { nextVote, withVote } from './review-vote';

const votes = fc.constantFrom<VoteType | null>('like', 'dislike', null);

const reviews = fc
  .record({
    likesCount: fc.nat({ max: 1000 }),
    dislikesCount: fc.nat({ max: 1000 }),
    currentUserVote: votes,
  })
  .map(
    ({ likesCount, dislikesCount, currentUserVote }) =>
      ({
        id: 'review-id',
        likesCount: likesCount + (currentUserVote === 'like' ? 1 : 0),
        dislikesCount: dislikesCount + (currentUserVote === 'dislike' ? 1 : 0),
        currentUserVote,
      }) as Review,
  );

function othersVotes(review: Review) {
  return {
    likes: review.likesCount - (review.currentUserVote === 'like' ? 1 : 0),
    dislikes: review.dislikesCount - (review.currentUserVote === 'dislike' ? 1 : 0),
  };
}

describe('withVote', () => {
  it('only ever moves the viewer’s own vote between the counters', () => {
    fc.assert(
      fc.property(reviews, votes, (review, vote) => {
        const voted = withVote(review, vote);
        expect(voted.currentUserVote).toBe(vote);
        expect(othersVotes(voted)).toEqual(othersVotes(review));
      }),
    );
  });

  it('is undone by restoring the previous vote', () => {
    fc.assert(
      fc.property(reviews, votes, (review, vote) => {
        const restored = withVote(withVote(review, vote), review.currentUserVote as VoteType | null);
        expect(restored).toEqual(review);
      }),
    );
  });
});

describe('nextVote', () => {
  it('toggles the pressed vote off and switches from the other one', () => {
    expect(nextVote('like', 'like')).toBeNull();
    expect(nextVote('dislike', 'like')).toBe('like');
    expect(nextVote(null, 'dislike')).toBe('dislike');
  });
});
