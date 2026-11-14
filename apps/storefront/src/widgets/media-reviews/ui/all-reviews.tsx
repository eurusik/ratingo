'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@heroui/react';
import type { ReviewPage, ReviewSort } from '@/shared/api';
import { useTranslation } from '@/shared/i18n';
import { SegmentedFilter } from '@/shared/ui';
import type { CommunityScore, ReviewedMedia } from '../model/reviewed-media';
import {
  REVIEW_SORTS,
  REVIEW_SORT_PARAM,
  parseReviewSort,
  reviewSortSearch,
} from '../model/review-sort';
import { useReviewPages } from '../model/use-review-lists';
import { ReviewsBoard } from './reviews-board';
import { ReviewsHeading } from './reviews-heading';

interface AllReviewsProps {
  media: ReviewedMedia;
  community: CommunityScore;
  initialSort: ReviewSort;
  initialPage: ReviewPage | null;
}

function replaceSortInUrl(sort: ReviewSort): void {
  const url = `${window.location.pathname}${reviewSortSearch(sort)}`;
  window.history.replaceState(null, '', url);
}

export function AllReviews({ media, community, initialSort, initialPage }: AllReviewsProps) {
  const { dict } = useTranslation();
  const sort = parseReviewSort(useSearchParams()?.get(REVIEW_SORT_PARAM));
  const pages = useReviewPages(media.mediaItemId, sort, sort === initialSort ? initialPage : null);
  const reviews = useMemo(
    () => pages.data?.pages.flatMap((page) => page.reviews) ?? [],
    [pages.data],
  );
  const total = pages.data?.pages[0]?.total ?? 0;
  const sortOptions = REVIEW_SORTS.map((id) => ({ id, label: dict.reviews.sort[id] }));

  return (
    <ReviewsBoard
      media={media}
      community={community}
      reviews={reviews}
      total={total}
      status={pages.status}
      onRetry={() => void pages.refetch()}
      heading={
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-4">
          <ReviewsHeading total={total} level="h1" />
          <SegmentedFilter
            label={dict.reviews.sortLabel}
            options={sortOptions}
            value={sort}
            onChange={replaceSortInUrl}
            className="px-0"
          />
        </div>
      }
      footer={
        pages.hasNextPage ? (
          <Button
            variant="outline"
            size="lg"
            isPending={pages.isFetchingNextPage}
            onPress={() => void pages.fetchNextPage()}
            className="min-h-12 self-stretch rounded-full font-semibold md:self-start"
          >
            {dict.reviews.loadMore}
          </Button>
        ) : null
      }
    />
  );
}
