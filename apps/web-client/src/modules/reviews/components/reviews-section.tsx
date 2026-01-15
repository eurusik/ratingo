'use client';

import { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { HTTPError } from 'ky';
import {
  useReviews,
  useCreateReview,
  useVoteReview,
  useUnvoteReview,
} from '@/core/query';
import { useAuth, useAuthModalStore } from '@/core/auth';
import type { ReviewSort, VoteType } from '@/core/api/reviews.client';
import { useTranslation } from '@/shared/i18n';
import { cn } from '@/shared/utils';
import {
  Button,
  Skeleton,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui';
import { ReviewCard } from './review-card';
import { ReviewForm } from './review-form';
import type { ReviewFormData } from '../schemas';

interface ReviewsSectionProps {
  mediaItemId: string;
  className?: string;
}

const SORT_VALUES: ReviewSort[] = ['newest', 'oldest', 'most_liked'];

const PAGE_SIZE = 10;

export function ReviewsSection({ mediaItemId, className }: ReviewsSectionProps) {
  const { dict } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const { openLogin } = useAuthModalStore();
  const [sort, setSort] = useState<ReviewSort>('newest');
  const [limit, setLimit] = useState(PAGE_SIZE);

  // Queries
  const {
    data: reviewsData,
    isLoading: isLoadingReviews,
    error: reviewsError,
  } = useReviews({ mediaItemId, sort, limit });

  // Mutations
  const createReview = useCreateReview();
  const voteReview = useVoteReview(mediaItemId);
  const unvoteReview = useUnvoteReview(mediaItemId);

  const reviews = reviewsData?.data ?? [];
  const totalReviews = reviewsData?.meta?.total ?? 0;
  const hasMore = reviews.length < totalReviews;

  // Check if current user already has a review in the list
  const userHasReview = user ? reviews.some((r) => r.author.id === user.id) : false;
  // Show form to guests too (they'll see login modal on submit)
  const showForm = !userHasReview && !isLoadingReviews;

  const handleCreateReview = async (data: ReviewFormData) => {
    // Guest tries to submit - show login modal
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    try {
      await createReview.mutateAsync({
        mediaItemId,
        ...data,
      });
      toast.success(dict.reviews.toast.created);
    } catch (error) {
      if (error instanceof HTTPError) {
        try {
          const body = await error.response.clone().json();
          if (body?.message?.includes('already reviewed')) {
            toast.error(dict.reviews.toast.alreadyReviewed);
            return;
          }
        } catch {
          // ignore parse error
        }
      }
      toast.error(dict.reviews.toast.createError);
    }
  };

  const handleVoteError = async (error: unknown) => {
    if (error instanceof HTTPError) {
      try {
        const body = await error.response.clone().json();
        if (body?.message?.includes('own review')) {
          toast.error(dict.reviews.toast.voteOwnReview);
          return;
        }
      } catch {
        // ignore parse error
      }
    }
    toast.error(dict.reviews.toast.voteError);
  };

  const handleVote = (reviewId: string, voteType: VoteType) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    voteReview.mutate(
      { reviewId, voteType },
      { onError: handleVoteError },
    );
  };

  const handleUnvote = (reviewId: string) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    unvoteReview.mutate(reviewId, { onError: handleVoteError });
  };

  const handleLoadMore = () => {
    setLimit((prev) => prev + PAGE_SIZE);
  };

  if (reviewsError) {
    return (
      <section className={cn('space-y-4', className)}>
        <SectionHeader dict={dict} totalReviews={0} sort={sort} onSortChange={setSort} />
        <div className="text-center py-8 text-zinc-500">
          {dict.reviews.loadError}
        </div>
      </section>
    );
  }

  return (
    <section className={cn('space-y-4', className)}>
      <SectionHeader dict={dict} totalReviews={totalReviews} sort={sort} onSortChange={setSort} />

      {/* Review form (show to guests too, they'll see login modal on submit) */}
      {showForm && (
        <ReviewForm
          onSubmit={handleCreateReview}
          isSubmitting={createReview.isPending}
          isGuest={!isAuthenticated}
        />
      )}

      {/* Reviews list */}
      {isLoadingReviews ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState dict={dict} isAuthenticated={isAuthenticated} hasForm={showForm} />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onVote={handleVote}
              onUnvote={handleUnvote}
              isAuthenticated={isAuthenticated}
              isVoting={voteReview.isPending || unvoteReview.isPending}
              isOwnReview={user?.id === review.author.id}
            />
          ))}

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                className="flex items-center gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                {dict.reviews.loadMore}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

type Dict = ReturnType<typeof import('@/shared/i18n').getDictionary>;

interface SectionHeaderProps {
  dict: Dict;
  totalReviews: number;
  sort: ReviewSort;
  onSortChange: (sort: ReviewSort) => void;
}

function SectionHeader({ dict, totalReviews, sort, onSortChange }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          {dict.reviews.title}
        </h2>
        {totalReviews > 0 && (
          <span className="text-sm text-zinc-500">({totalReviews})</span>
        )}
      </div>

      <Select value={sort} onValueChange={(value) => onSortChange(value as ReviewSort)}>
        <SelectTrigger className="w-auto gap-2 bg-zinc-800/50 border-zinc-700 text-zinc-300 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-800 border-zinc-700">
          {SORT_VALUES.map((value) => (
            <SelectItem
              key={value}
              value={value}
              className="text-zinc-300 focus:bg-zinc-700 focus:text-zinc-100"
            >
              {dict.reviews.sort[value]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface EmptyStateProps {
  dict: Dict;
  isAuthenticated: boolean;
  hasForm: boolean;
}

function EmptyState({ dict, isAuthenticated, hasForm }: EmptyStateProps) {
  return (
    <div className="text-center py-12 text-zinc-500">
      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
      <p className="text-lg mb-2">{dict.reviews.empty}</p>
      {!isAuthenticated && (
        <p className="text-sm">{dict.reviews.emptyHint}</p>
      )}
      {isAuthenticated && hasForm && (
        <p className="text-sm">{dict.reviews.emptyHintAuth}</p>
      )}
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="bg-zinc-900/50 rounded-lg border border-zinc-800/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-16 w-full" />
      <div className="flex items-center gap-4">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-4 w-12" />
      </div>
    </div>
  );
}
