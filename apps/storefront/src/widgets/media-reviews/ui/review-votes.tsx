'use client';

import { ToggleButton } from '@heroui/react';
import { ThumbsDown, ThumbsUp } from 'lucide-react';
import type { Review } from '@/shared/api';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';
import { useReviewsActions } from './reviews-context';

const VOTE_TOGGLE = 'min-h-tap rounded-full px-3 font-bold';

export function ReviewVotes({ review, isOwn }: { review: Review; isOwn: boolean }) {
  const { dict, locale } = useTranslation();
  const { vote } = useReviewsActions();
  const likes = formatCompactCount(locale, review.likesCount);

  return (
    <div className="flex items-center gap-1">
      <ToggleButton
        variant="ghost"
        isSelected={review.currentUserVote === 'like'}
        isDisabled={isOwn}
        onChange={() => vote(review, 'like')}
        aria-label={interpolate(dict.reviews.card.helpfulCount, { count: likes })}
        className={`${VOTE_TOGGLE} data-[selected=true]:bg-accent-soft data-[selected=true]:text-accent`}
      >
        <ThumbsUp aria-hidden className="size-4.5" />
        <span className="tabular-nums">{likes}</span>
      </ToggleButton>
      {isOwn ? null : (
        <ToggleButton
          variant="ghost"
          isIconOnly
          isSelected={review.currentUserVote === 'dislike'}
          onChange={() => vote(review, 'dislike')}
          aria-label={dict.reviews.card.notHelpful}
          className={`${VOTE_TOGGLE} min-w-tap px-0 text-muted data-[selected=true]:bg-danger-soft data-[selected=true]:text-danger`}
        >
          <ThumbsDown aria-hidden className="size-4.5" />
        </ToggleButton>
      )}
    </div>
  );
}
