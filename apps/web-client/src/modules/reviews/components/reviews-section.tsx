'use client';

import { useState } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  useReviews,
  useCreateReview,
  useVoteReview,
  useUnvoteReview,
  useReportReview,
} from '@/core/query';
import { useAuth, useAuthModalStore } from '@/core/auth';
import { getApiErrorCode, ErrorCode } from '@/core/api';
import type { ReviewSort, VoteType, ReportReason } from '@/core/api/reviews.client';
import { useTranslation } from '@/shared/i18n';
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
import { ReviewReportDialog } from './review-report-dialog';
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
  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);

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
  const reportReview = useReportReview();

  const reviews = reviewsData?.data ?? [];
  const totalReviews = reviewsData?.meta?.total ?? 0;
  const hasMore = reviews.length < totalReviews;

  // Check if current user already has a review in the list
  const userHasReview = user ? reviews.some((r) => r.author.id === user.id) : false;
  // Show form to guests too (they'll see login modal on submit)
  const showForm = !userHasReview && !isLoadingReviews;

  const handleCreateReview = async (data: ReviewFormData) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }

    try {
      await createReview.mutateAsync({ mediaItemId, ...data });
      toast.success(dict.reviews.toast.created);
    } catch (error) {
      const code = await getApiErrorCode(error);
      if (code === ErrorCode.REVIEW_ALREADY_EXISTS) {
        toast.error(dict.reviews.toast.alreadyReviewed);
      } else {
        toast.error(dict.reviews.toast.createError);
      }
    }
  };

  const handleVoteError = async (error: unknown) => {
    const code = await getApiErrorCode(error);
    if (code === ErrorCode.FORBIDDEN) {
      toast.error(dict.reviews.toast.voteOwnReview);
    } else {
      toast.error(dict.reviews.toast.voteError);
    }
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

  const handleReport = (reviewId: string) => {
    if (!isAuthenticated) {
      openLogin();
      return;
    }
    setReportingReviewId(reviewId);
  };

  const handleReportSubmit = async (reason: ReportReason, details?: string) => {
    if (!reportingReviewId) return;

    try {
      await reportReview.mutateAsync({ reviewId: reportingReviewId, reason, details });
      toast.success(dict.reviews.report.toast.submitted);
    } catch (error) {
      const code = await getApiErrorCode(error);
      if (code === ErrorCode.REPORT_ALREADY_EXISTS) {
        toast.error(dict.reviews.report.toast.alreadyReported);
      } else {
        toast.error(dict.reviews.report.toast.error);
      }
    } finally {
      setReportingReviewId(null);
    }
  };

  if (reviewsError) {
    return (
      <section className={className}>
        <SectionHeader dict={dict} totalReviews={0} sort={sort} onSortChange={setSort} />
        <div className="text-center py-8 text-cinema-text-muted">
          {dict.reviews.loadError}
        </div>
      </section>
    );
  }

  return (
    <section className={className}>
      {/* Header - always show, but hide sort when no reviews */}
      <SectionHeader
        dict={dict}
        totalReviews={totalReviews}
        sort={sort}
        onSortChange={setSort}
        showSort={totalReviews > 0}
      />

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
        <div className="space-y-6">
          {[1, 2, 3].map((i) => (
            <ReviewCardSkeleton key={i} />
          ))}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-6">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              mediaItemId={mediaItemId}
              onVote={handleVote}
              onUnvote={handleUnvote}
              onReport={handleReport}
              isAuthenticated={isAuthenticated}
              isVoting={voteReview.isPending || unvoteReview.isPending}
              isOwnReview={user?.id === review.author.id}
              currentUserId={user?.id}
            />
          ))}

          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center py-4">
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
      ) : !showForm && (
        /* Empty state - only show if form is hidden (user already reviewed) */
        <EmptyState dict={dict} />
      )}

      {/* Report dialog */}
      <ReviewReportDialog
        open={!!reportingReviewId}
        onOpenChange={(open) => !open && setReportingReviewId(null)}
        onSubmit={handleReportSubmit}
        isSubmitting={reportReview.isPending}
      />
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
  showSort?: boolean;
}

function SectionHeader({ dict, totalReviews, sort, onSortChange, showSort = true }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between pb-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-cinema-text-secondary" />
        <h2 className="text-base font-semibold text-cinema-text-primary uppercase tracking-wider">
          {dict.reviews.title}
        </h2>
        {totalReviews > 0 && (
          <span className="text-sm text-cinema-text-muted">({totalReviews})</span>
        )}
      </div>

      {showSort && (
        <Select value={sort} onValueChange={(value) => onSortChange(value as ReviewSort)}>
          <SelectTrigger className="w-auto gap-2 bg-cinema-elevated/50 border-cinema-border text-cinema-text-secondary text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-cinema-elevated border-cinema-border">
            {SORT_VALUES.map((value) => (
              <SelectItem
                key={value}
                value={value}
                className="text-cinema-text-secondary focus:bg-cinema-card focus:text-cinema-text-primary"
              >
                {dict.reviews.sort[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function EmptyState({ dict }: { dict: Dict }) {
  return (
    <div className="text-center py-8">
      <p className="text-cinema-text-muted">{dict.reviews.emptyHintAuth}</p>
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="px-4 py-6 space-y-4">
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
