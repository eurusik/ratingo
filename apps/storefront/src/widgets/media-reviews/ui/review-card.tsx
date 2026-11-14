'use client';

import { useState } from 'react';
import { Button, Chip } from '@heroui/react';
import { pluralize } from '@ratingo/web-core/lib';
import { MessageCircle } from 'lucide-react';
import { presetForRating } from '@/entities/library';
import type { Review } from '@/shared/api';
import { interpolate, useTranslation, type Dictionary, type Locale } from '@/shared/i18n';
import { formatScore, scoreFromRating } from '@/shared/lib';
import { ReviewAvatar } from './review-avatar';
import { ReviewBody } from './review-body';
import { ReviewMenu } from './review-menu';
import { ReviewTime } from './review-time';
import { ReviewVotes } from './review-votes';
import { useReviewsActions } from './reviews-context';
import { InlineThread } from './inline-thread';

const FOOTER_BUTTON = 'min-h-tap rounded-full px-3 text-sm font-semibold';

function ScoreChip({ rating }: { rating: number }) {
  const { dict, locale } = useTranslation();
  const score = formatScore(locale, scoreFromRating(rating));

  return (
    <Chip
      size="sm"
      variant="soft"
      aria-label={interpolate(dict.reviews.card.score, { score })}
      className="shrink-0 font-extrabold tabular-nums"
    >
      <span aria-hidden>{presetForRating(rating)?.emoji}</span>
      {score}
    </Chip>
  );
}

function repliesLabel(review: Review, isThreadOpen: boolean, dict: Dictionary, locale: Locale) {
  if (isThreadOpen) return dict.reviews.card.hideReplies;
  if (review.repliesCount === 0) return dict.reviews.card.reply;
  return interpolate(pluralize(review.repliesCount, dict.reviews.card.replies, locale), {
    count: review.repliesCount,
  });
}

export function ReviewCard({ review }: { review: Review }) {
  const { dict, locale } = useTranslation();
  const actions = useReviewsActions();
  const [isThreadOpen, setIsThreadOpen] = useState(false);
  const isOwn = review.author.id === actions.viewerId;
  const rating = isOwn ? (actions.ownRating ?? review.rating) : review.rating;
  const showsInlineThread = actions.isDesktop && isThreadOpen;

  const toggleReplies = () => {
    if (actions.isDesktop) setIsThreadOpen((open) => !open);
    else actions.openThread(review);
  };

  return (
    <article
      aria-label={interpolate(dict.reviews.card.label, { name: review.author.username })}
      className={`flex flex-col gap-2.5 rounded-3xl border p-3.5 md:p-5 ${isOwn ? 'border-accent/35 bg-accent-soft' : 'border-transparent bg-surface'}`}
    >
      <header className="flex items-center gap-2.5">
        <ReviewAvatar username={review.author.username} avatarUrl={review.author.avatarUrl} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex min-w-0 items-baseline gap-1.5 text-[15px] font-bold">
            <span className="truncate">{review.author.username}</span>
            {isOwn ? (
              <span className="shrink-0 text-xs font-semibold text-accent">
                {dict.reviews.card.you}
              </span>
            ) : null}
          </span>
          <span className="text-xs text-muted">
            <ReviewTime date={review.createdAt} />
          </span>
        </div>
        {rating === null ? null : <ScoreChip rating={rating} />}
        <ReviewMenu review={review} isOwn={isOwn} />
      </header>
      <ReviewBody text={review.content} hasSpoiler={review.hasSpoiler} />
      <footer className="-mx-1.5 -mb-1 flex items-center gap-1">
        <ReviewVotes review={review} isOwn={isOwn} />
        <span className="flex-1" />
        {isOwn ? (
          <Button
            variant="ghost"
            onPress={() => actions.compose(review)}
            className={`${FOOTER_BUTTON} text-accent`}
          >
            {dict.reviews.card.edit}
          </Button>
        ) : null}
        <Button
          variant="ghost"
          aria-expanded={actions.isDesktop ? isThreadOpen : undefined}
          onPress={toggleReplies}
          className={FOOTER_BUTTON}
        >
          <MessageCircle aria-hidden className="size-4.5" />
          {repliesLabel(review, showsInlineThread, dict, locale)}
        </Button>
      </footer>
      {showsInlineThread ? <InlineThread review={review} /> : null}
    </article>
  );
}
