import type { ReviewSort } from '@/shared/api';
import { loadFirstReviewPage, loadTopReviews } from '../api/load-reviews';
import type { CommunityScore, ReviewedMedia } from '../model/reviewed-media';
import { AllReviews } from './all-reviews';
import { MediaReviews } from './media-reviews';

interface ReviewsSectionProps {
  media: ReviewedMedia;
  community: CommunityScore;
}

export async function MediaReviewsSection({ media, community }: ReviewsSectionProps) {
  const initialPage = await loadTopReviews(media.mediaItemId);
  return <MediaReviews media={media} community={community} initialPage={initialPage} />;
}

export async function AllReviewsSection({
  media,
  community,
  sort,
}: ReviewsSectionProps & { sort: ReviewSort }) {
  const initialPage = await loadFirstReviewPage(media.mediaItemId, sort);
  return (
    <AllReviews media={media} community={community} initialSort={sort} initialPage={initialPage} />
  );
}
