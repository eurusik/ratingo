'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { useAuth } from '@ratingo/web-core/auth';
import { useMediaState } from '@/entities/library';
import type { Review } from '@/shared/api';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config';
import { useTranslation } from '@/shared/i18n';
import { useMediaQuery } from '@/shared/lib';
import {
  forgetHiddenReviewsUnlessViewer,
  reportedReviews,
  reviewsBeingDeleted,
  useIds,
} from '../model/hidden-reviews';
import { withOwnReviewFirst } from '../model/review-order';
import type { CommunityScore, ReviewedMedia } from '../model/reviewed-media';
import { useComposeAfterSignIn } from '../model/use-compose-after-sign-in';
import { useComposeState } from '../model/use-compose-state';
import { useMyReview } from '../model/use-review-lists';
import { useDeleteReview } from '../model/use-review-editor';
import { useReviewVote } from '../model/use-review-vote';
import { CommunityAside } from './community-aside';
import { InlineCompose } from './inline-compose';
import { ReportedReview } from './reported-review';
import { ReviewCard } from './review-card';
import { ReviewDialogs } from './review-dialogs';
import { ReviewsProvider, useReviewsActions, type ReviewsActions } from './reviews-context';
import { ReviewsSkeleton, ViewerPromptSkeleton } from './reviews-skeleton';
import { EmptyReviews, GuestPrompt, WritePrompt } from './viewer-prompt';

type ReviewsStatus = 'pending' | 'error' | 'success';

export interface ReviewsBoardProps {
  media: ReviewedMedia;
  community: CommunityScore;
  reviews: readonly Review[];
  total: number;
  status: ReviewsStatus;
  onRetry: () => void;
  heading: ReactNode;
  footer?: ReactNode;
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  const { dict } = useTranslation();
  return (
    <div role="alert" className="flex items-center gap-3 rounded-3xl bg-surface p-3.5 text-sm">
      <span className="flex-1 text-muted">{dict.reviews.loadError}</span>
      <Button variant="secondary" size="sm" onPress={onRetry} className="min-h-tap">
        {dict.common.retry}
      </Button>
    </div>
  );
}

interface ViewerSlotProps {
  hasMine: boolean;
  isEmpty: boolean;
  editing: Review | null;
  onDoneEditing: () => void;
}

function ViewerSlot({ hasMine, isEmpty, editing, onDoneEditing }: ViewerSlotProps) {
  const { isAuthenticated } = useAuth();
  const { isDesktop } = useReviewsActions();

  if (isDesktop && editing) {
    return <InlineCompose key={editing.id} editing={editing} onDone={onDoneEditing} />;
  }
  if (hasMine) return null;
  if (isDesktop && isAuthenticated) return <InlineCompose editing={null} onDone={onDoneEditing} />;
  if (isEmpty) return <EmptyReviews />;
  return isAuthenticated ? <WritePrompt /> : <GuestPrompt />;
}

export function ReviewsBoard({
  media,
  community,
  reviews,
  total,
  status,
  onRetry,
  heading,
  footer,
}: ReviewsBoardProps) {
  const { user, isLoading: isAuthResolving } = useAuth();
  const viewerId = user?.id ?? null;
  const isDesktop = useMediaQuery(DESKTOP_MEDIA_QUERY);
  const ownRating = useMediaState(media.mediaItemId).mediaState?.rating ?? null;
  const myReview = useMyReview(media.mediaItemId);
  const reported = useIds(reportedReviews);
  const deleting = useIds(reviewsBeingDeleted);
  const vote = useReviewVote(media.mediaItemId);
  const remove = useDeleteReview(media.mediaItemId);
  const compose = useComposeState();
  const [reportTarget, setReportTarget] = useState<Review | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  useEffect(() => forgetHiddenReviewsUnlessViewer(viewerId), [viewerId]);
  useComposeAfterSignIn(media.mediaItemId, myReview, compose.open);

  const { mine } = myReview;
  const isDeletingMine = mine !== null && deleting.has(mine.id);
  const ownReview = isDeletingMine ? null : mine;
  const inlineEditing = isDesktop && compose.isOpen ? compose.editing : null;
  const ordered = useMemo(() => {
    const hidden = new Set(deleting);
    if (inlineEditing && ownReview) hidden.add(ownReview.id);
    return withOwnReviewFirst(ownReview, reviews, hidden);
  }, [deleting, inlineEditing, ownReview, reviews]);
  const threadReview = ordered.find((review) => review.id === threadId) ?? null;

  const actions = useMemo<ReviewsActions>(
    () => ({
      media,
      viewerId,
      ownRating,
      isDesktop,
      compose: compose.open,
      report: setReportTarget,
      openThread: (review) => setThreadId(review.id),
      vote,
      remove,
    }),
    [media, viewerId, ownRating, isDesktop, compose.open, vote, remove],
  );

  const isListReady = status === 'success';
  const isViewerResolving = myReview.isResolving || isAuthResolving;
  const isViewerReady = isListReady && !isViewerResolving && !isDeletingMine;

  return (
    <ReviewsProvider value={actions}>
      <section
        aria-labelledby="reviews-heading"
        aria-busy={status === 'pending'}
        className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:gap-x-12"
      >
        <div className="flex min-w-0 flex-col gap-4">
          {heading}
          {status === 'error' ? <LoadError onRetry={onRetry} /> : null}
          {myReview.isError ? <LoadError onRetry={myReview.retry} /> : null}
          {status === 'pending' ? <ReviewsSkeleton /> : null}
          {isListReady && isViewerResolving ? <ViewerPromptSkeleton /> : null}
          {isViewerReady && !myReview.isError ? (
            <ViewerSlot
              hasMine={ownReview !== null}
              isEmpty={total === 0 && ordered.length === 0}
              editing={inlineEditing}
              onDoneEditing={compose.close}
            />
          ) : null}
          {ordered.map((review) =>
            reported.has(review.id) ? (
              <ReportedReview key={review.id} review={review} />
            ) : (
              <ReviewCard key={review.id} review={review} />
            ),
          )}
          {footer}
        </div>
        <CommunityAside community={community} />
      </section>
      <ReviewDialogs
        isPhone={!isDesktop}
        compose={compose}
        threadReview={threadReview}
        onCloseThread={() => setThreadId(null)}
        reportReview={reportTarget}
        onCloseReport={() => setReportTarget(null)}
      />
    </ReviewsProvider>
  );
}
