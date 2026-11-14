'use client';

import { useMemo } from 'react';
import { pluralize } from '@ratingo/web-core/lib';
import { mediaReviewsRoute } from '@/shared/config';
import { interpolate, useTranslation } from '@/shared/i18n';
import { formatCompactCount } from '@/shared/lib';
import { ForwardLink } from '@/shared/ui';
import type { ReviewPage } from '@/shared/api';
import type { CommunityScore, ReviewedMedia } from '../model/reviewed-media';
import { TOP_REVIEWS_SHOWN } from '../model/review-queries';
import { useMyReview, useTopReviews } from '../model/use-review-lists';
import { ReviewsBoard } from './reviews-board';
import { ReviewsHeading } from './reviews-heading';

interface MediaReviewsProps {
  media: ReviewedMedia;
  community: CommunityScore;
  initialPage: ReviewPage | null;
}

export function MediaReviews({ media, community, initialPage }: MediaReviewsProps) {
  const { dict, locale } = useTranslation();
  const top = useTopReviews(media.mediaItemId, initialPage);
  const { mine } = useMyReview(media.mediaItemId);
  const total = top.data?.total ?? 0;
  const mineId = mine?.id;
  const others = useMemo(
    () =>
      (top.data?.reviews ?? [])
        .filter((review) => review.id !== mineId)
        .slice(0, TOP_REVIEWS_SHOWN),
    [top.data, mineId],
  );
  const hasMore = total > others.length + (mine ? 1 : 0);
  const allHref = mediaReviewsRoute(media.type, media.slug);

  return (
    <ReviewsBoard
      media={media}
      community={community}
      reviews={others}
      total={total}
      status={top.status}
      onRetry={() => void top.refetch()}
      heading={
        <ReviewsHeading
          total={total}
          trailing={
            hasMore ? (
              <ForwardLink
                href={allHref}
                className="inline-flex min-h-tap items-center px-1 text-[15px] font-semibold text-accent no-underline md:hidden"
              >
                {dict.reviews.all}
              </ForwardLink>
            ) : null
          }
        />
      }
      footer={
        hasMore ? (
          <ForwardLink
            href={allHref}
            className="flex min-h-12 items-center justify-center self-stretch rounded-full border border-separator px-5 text-[15px] font-semibold text-foreground no-underline md:self-start"
          >
            {interpolate(pluralize(total, dict.reviews.allCount, locale), {
              count: formatCompactCount(locale, total),
            })}
          </ForwardLink>
        ) : null
      }
    />
  );
}
