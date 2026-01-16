'use client';

import { useState, useEffect } from 'react';
import { ThumbsUp, ThumbsDown, MessageCircle, Flag, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { uk, enUS } from 'date-fns/locale';
import { VOTE_TYPE, type ReviewResponseDto, type VoteType } from '@/core/api/reviews.client';
import { useTranslation, useLocale } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import { Avatar, AvatarImage, AvatarFallback } from '@/shared/ui';
import { ReviewReplies } from './review-replies';

const DATE_LOCALES = { uk, en: enUS } as const;

interface ReviewCardProps {
  review: ReviewResponseDto;
  mediaItemId: string;
  onVote?: (reviewId: string, voteType: VoteType) => void;
  onUnvote?: (reviewId: string) => void;
  onReport?: (reviewId: string) => void;
  isAuthenticated?: boolean;
  isVoting?: boolean;
  isOwnReview?: boolean;
  currentUserId?: string;
}

export function ReviewCard({
  review,
  mediaItemId,
  onVote,
  onUnvote,
  onReport,
  isAuthenticated = false,
  isVoting = false,
  isOwnReview = false,
  currentUserId,
}: ReviewCardProps) {
  const { dict } = useTranslation();
  const locale = useLocale();
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [animatingVote, setAnimatingVote] = useState<VoteType | null>(null);

  const timeAgo = formatDistanceToNow(new Date(review.createdAt), {
    addSuffix: true,
    locale: DATE_LOCALES[locale],
  });

  // Disable only when voting in progress or own review (guests can click - parent shows login modal)
  const isVoteDisabled = isVoting || isOwnReview;

  // Clear animation after it completes
  useEffect(() => {
    if (animatingVote) {
      const timeout = setTimeout(() => setAnimatingVote(null), 300);
      return () => clearTimeout(timeout);
    }
  }, [animatingVote]);

  const handleVote = (voteType: VoteType) => {
    if (isVoteDisabled) return;

    // Trigger animation
    setAnimatingVote(voteType);

    // If clicking the same vote type, unvote
    if (review.currentUserVote === voteType) {
      onUnvote?.(review.id);
    } else {
      onVote?.(review.id, voteType);
    }
  };

  const showSpoilerOverlay = review.hasSpoiler && !spoilerRevealed;

  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800/50 p-4 space-y-3">
      {/* Header: Author + Rating + Time */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {review.author.avatarUrl && (
              <AvatarImage src={review.author.avatarUrl} alt={review.author.username} />
            )}
            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
              {review.author.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="text-sm font-medium text-zinc-200">
              {review.author.username}
            </span>
            {!review.author.isProfilePublic && (
              <span className="ml-2 text-xs text-zinc-500">({dict.reviews.card.private})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 text-sm">
          {review.rating !== null && (
            <span className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-300 font-medium">
              ⭐ {review.rating}
            </span>
          )}
          <span className="text-zinc-500">{timeAgo}</span>
        </div>
      </div>

      {/* Content with spoiler handling */}
      <div className="relative">
        {/* Spoiler warning badge */}
        {review.hasSpoiler && (
          <div className="flex items-center gap-1.5 mb-2 text-amber-500/80">
            <EyeOff className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{dict.reviews.card.spoilerWarning}</span>
          </div>
        )}

        {/* Content with blur transition */}
        <div
          className={cn(
            'transition-all duration-150 ease-out',
            showSpoilerOverlay && 'blur-sm select-none',
          )}
        >
          <p className="text-zinc-300 leading-relaxed">{review.content}</p>
        </div>

        {/* Subtle reveal link */}
        {showSpoilerOverlay && (
          <button
            onClick={() => setSpoilerRevealed(true)}
            className="absolute inset-0 flex items-center justify-center group"
          >
            <span className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300 transition-colors">
              <Eye className="w-4 h-4" />
              <span>{dict.reviews.card.showSpoiler}</span>
            </span>
          </button>
        )}
      </div>

      {/* Actions: Votes + Replies + Report */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/50">
        <div className="flex items-center gap-4">
          {/* Like button */}
          <button
            onClick={() => handleVote(VOTE_TYPE.LIKE)}
            disabled={isVoteDisabled}
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors',
              review.currentUserVote === VOTE_TYPE.LIKE
                ? 'text-green-500'
                : 'text-zinc-500 hover:text-zinc-300',
              isVoteDisabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className="relative">
              <ThumbsUp
                className={cn(
                  'w-4 h-4 transition-transform duration-300 relative z-10',
                  review.currentUserVote === VOTE_TYPE.LIKE && 'fill-current',
                  animatingVote === VOTE_TYPE.LIKE && 'animate-vote-pop',
                )}
              />
              {animatingVote === VOTE_TYPE.LIKE && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="absolute w-4 h-4 rounded-full border-2 border-green-500 animate-vote-burst" />
                </span>
              )}
            </span>
            <span>{review.likesCount}</span>
          </button>

          {/* Dislike button */}
          <button
            onClick={() => handleVote(VOTE_TYPE.DISLIKE)}
            disabled={isVoteDisabled}
            className={cn(
              'flex items-center gap-1.5 text-sm transition-colors',
              review.currentUserVote === VOTE_TYPE.DISLIKE
                ? 'text-red-500'
                : 'text-zinc-500 hover:text-zinc-300',
              isVoteDisabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            <span className="relative">
              <ThumbsDown
                className={cn(
                  'w-4 h-4 transition-transform duration-300 relative z-10',
                  review.currentUserVote === VOTE_TYPE.DISLIKE && 'fill-current',
                  animatingVote === VOTE_TYPE.DISLIKE && 'animate-vote-pop',
                )}
              />
              {animatingVote === VOTE_TYPE.DISLIKE && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="absolute w-4 h-4 rounded-full border-2 border-red-500 animate-vote-burst" />
                </span>
              )}
            </span>
            <span>{review.dislikesCount}</span>
          </button>

          {/* Replies count */}
          {review.repliesCount > 0 && (
            <div className="flex items-center gap-1.5 text-sm text-zinc-500">
              <MessageCircle className="w-4 h-4" />
              <span>{review.repliesCount}</span>
            </div>
          )}
        </div>

        {/* Report button */}
        {isAuthenticated && onReport && (
          <button
            onClick={() => onReport(review.id)}
            className="flex items-center gap-1.5 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Flag className="w-3.5 h-3.5" />
            <span>{dict.reviews.card.report}</span>
          </button>
        )}
      </div>

      {/* Replies section */}
      <ReviewReplies
        reviewId={review.id}
        mediaItemId={mediaItemId}
        repliesCount={review.repliesCount}
        isAuthenticated={isAuthenticated}
        currentUserId={currentUserId}
      />
    </div>
  );
}
