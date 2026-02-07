import * as fc from 'fast-check';
import type { components } from '@ratingo/api-contract';

type ReviewResponseDto = components['schemas']['ReviewResponseDto'];

const VOTE_TYPE = { LIKE: 'like', DISLIKE: 'dislike' } as const;
type VoteType = (typeof VOTE_TYPE)[keyof typeof VOTE_TYPE];

// Inline pure functions to test without importing ky-dependent module.
// These must stay in sync with reviews.ts — if they drift, round-trip
// tests against the actual hooks will catch it.

type ReviewUpdater = (review: ReviewResponseDto) => ReviewResponseDto;

function applyVote(voteType: VoteType): ReviewUpdater {
  return (review) => {
    const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
    const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;
    const isLiking = voteType === VOTE_TYPE.LIKE;

    return {
      ...review,
      currentUserVote: voteType,
      likesCount: isLiking
        ? review.likesCount + (wasLiked ? 0 : 1)
        : review.likesCount - (wasLiked ? 1 : 0),
      dislikesCount: !isLiking
        ? review.dislikesCount + (wasDisliked ? 0 : 1)
        : review.dislikesCount - (wasDisliked ? 1 : 0),
    };
  };
}

function removeVote(review: ReviewResponseDto): ReviewResponseDto {
  const wasLiked = review.currentUserVote === VOTE_TYPE.LIKE;
  const wasDisliked = review.currentUserVote === VOTE_TYPE.DISLIKE;

  return {
    ...review,
    currentUserVote: null,
    likesCount: wasLiked ? review.likesCount - 1 : review.likesCount,
    dislikesCount: wasDisliked ? review.dislikesCount - 1 : review.dislikesCount,
  };
}

const VOTE_TYPES: VoteType[] = [VOTE_TYPE.LIKE, VOTE_TYPE.DISLIKE];

function reviewArb(
  overrides?: Partial<ReviewResponseDto>,
): fc.Arbitrary<ReviewResponseDto> {
  return fc
    .record({
      id: fc.uuid(),
      mediaItemId: fc.uuid(),
      content: fc.string({ minLength: 1, maxLength: 100 }),
      rating: fc.option(fc.integer({ min: 0, max: 100 }), { nil: null }),
      hasSpoiler: fc.boolean(),
      likesCount: fc.integer({ min: 0, max: 10_000 }),
      dislikesCount: fc.integer({ min: 0, max: 10_000 }),
      repliesCount: fc.nat({ max: 100 }),
      createdAt: fc.constant('2024-01-15T10:30:00.000Z'),
      updatedAt: fc.constant('2024-01-15T10:30:00.000Z'),
      author: fc.constant({
        id: '00000000-0000-0000-0000-000000000001',
        username: 'testuser',
        avatarUrl: null,
      }),
      currentUserVote: fc.constantFrom(VOTE_TYPE.LIKE, VOTE_TYPE.DISLIKE, null),
    })
    .map((review) => ({ ...review, ...overrides }) as ReviewResponseDto);
}

function voteTypeArb(): fc.Arbitrary<VoteType> {
  return fc.constantFrom(...VOTE_TYPES);
}

describe('applyVote', () => {
  it('sets currentUserVote to the given voteType', () => {
    fc.assert(
      fc.property(reviewArb(), voteTypeArb(), (review, voteType) => {
        const result = applyVote(voteType)(review);
        expect(result.currentUserVote).toBe(voteType);
      }),
    );
  });

  it('increments likesCount by 1 when liking a non-liked review', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: null }), (review) => {
        const result = applyVote(VOTE_TYPE.LIKE)(review);
        expect(result.likesCount).toBe(review.likesCount + 1);
        expect(result.dislikesCount).toBe(review.dislikesCount);
      }),
    );
  });

  it('swaps dislike to like: likesCount +1, dislikesCount -1', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: VOTE_TYPE.DISLIKE }), (review) => {
        const result = applyVote(VOTE_TYPE.LIKE)(review);
        expect(result.likesCount).toBe(review.likesCount + 1);
        expect(result.dislikesCount).toBe(review.dislikesCount - 1);
      }),
    );
  });

  it('is idempotent when re-applying the same vote', () => {
    fc.assert(
      fc.property(reviewArb(), voteTypeArb(), (review, voteType) => {
        const withVote = { ...review, currentUserVote: voteType };
        const result = applyVote(voteType)(withVote as ReviewResponseDto);
        expect(result.likesCount).toBe(withVote.likesCount);
        expect(result.dislikesCount).toBe(withVote.dislikesCount);
      }),
    );
  });

  it('increments dislikesCount by 1 when disliking a non-disliked review', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: null }), (review) => {
        const result = applyVote(VOTE_TYPE.DISLIKE)(review);
        expect(result.dislikesCount).toBe(review.dislikesCount + 1);
        expect(result.likesCount).toBe(review.likesCount);
      }),
    );
  });

  it('swaps like to dislike: dislikesCount +1, likesCount -1', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: VOTE_TYPE.LIKE }), (review) => {
        const result = applyVote(VOTE_TYPE.DISLIKE)(review);
        expect(result.dislikesCount).toBe(review.dislikesCount + 1);
        expect(result.likesCount).toBe(review.likesCount - 1);
      }),
    );
  });

  it('preserves all non-vote fields', () => {
    fc.assert(
      fc.property(reviewArb(), voteTypeArb(), (review, voteType) => {
        const result = applyVote(voteType)(review);
        expect(result.id).toBe(review.id);
        expect(result.mediaItemId).toBe(review.mediaItemId);
        expect(result.content).toBe(review.content);
        expect(result.rating).toBe(review.rating);
        expect(result.hasSpoiler).toBe(review.hasSpoiler);
        expect(result.repliesCount).toBe(review.repliesCount);
        expect(result.author).toBe(review.author);
      }),
    );
  });

  it('total vote count changes by at most 1', () => {
    fc.assert(
      fc.property(reviewArb(), voteTypeArb(), (review, voteType) => {
        const before = review.likesCount + review.dislikesCount;
        const result = applyVote(voteType)(review);
        const after = result.likesCount + result.dislikesCount;
        expect(Math.abs(after - before)).toBeLessThanOrEqual(1);
      }),
    );
  });
});

describe('removeVote', () => {
  it('sets currentUserVote to null', () => {
    fc.assert(
      fc.property(reviewArb(), (review) => {
        expect(removeVote(review).currentUserVote).toBeNull();
      }),
    );
  });

  it('decrements likesCount by 1 when removing a like', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: VOTE_TYPE.LIKE }), (review) => {
        const result = removeVote(review);
        expect(result.likesCount).toBe(review.likesCount - 1);
        expect(result.dislikesCount).toBe(review.dislikesCount);
      }),
    );
  });

  it('decrements dislikesCount by 1 when removing a dislike', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: VOTE_TYPE.DISLIKE }), (review) => {
        const result = removeVote(review);
        expect(result.dislikesCount).toBe(review.dislikesCount - 1);
        expect(result.likesCount).toBe(review.likesCount);
      }),
    );
  });

  it('does not change counts when there is no vote', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: null }), (review) => {
        const result = removeVote(review);
        expect(result.likesCount).toBe(review.likesCount);
        expect(result.dislikesCount).toBe(review.dislikesCount);
      }),
    );
  });

  it('preserves all non-vote fields', () => {
    fc.assert(
      fc.property(reviewArb(), (review) => {
        const result = removeVote(review);
        expect(result.id).toBe(review.id);
        expect(result.mediaItemId).toBe(review.mediaItemId);
        expect(result.content).toBe(review.content);
        expect(result.rating).toBe(review.rating);
        expect(result.hasSpoiler).toBe(review.hasSpoiler);
        expect(result.repliesCount).toBe(review.repliesCount);
        expect(result.author).toBe(review.author);
      }),
    );
  });

  it('round-trip: applyVote then removeVote restores original counts', () => {
    fc.assert(
      fc.property(reviewArb({ currentUserVote: null }), voteTypeArb(), (review, voteType) => {
        const voted = applyVote(voteType)(review);
        const unvoted = removeVote(voted);
        expect(unvoted.likesCount).toBe(review.likesCount);
        expect(unvoted.dislikesCount).toBe(review.dislikesCount);
        expect(unvoted.currentUserVote).toBeNull();
      }),
    );
  });
});
