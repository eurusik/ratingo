import type { Review, VoteType } from '@/shared/api';

function countWithout(review: Review, vote: VoteType) {
  return review.currentUserVote === vote ? -1 : 0;
}

export function withVote(review: Review, vote: VoteType | null): Review {
  return {
    ...review,
    currentUserVote: vote,
    likesCount: review.likesCount + countWithout(review, 'like') + (vote === 'like' ? 1 : 0),
    dislikesCount:
      review.dislikesCount + countWithout(review, 'dislike') + (vote === 'dislike' ? 1 : 0),
  };
}

export function nextVote(current: string | null, pressed: VoteType): VoteType | null {
  return current === pressed ? null : pressed;
}
