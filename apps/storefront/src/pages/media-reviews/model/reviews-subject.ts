import type { CommunityScore, ReviewedMedia } from '@/widgets/media-reviews';
import type { MediaType, MovieDetails, ShowDetails } from '@/shared/api';
import { scoreFromPercent } from '@/shared/lib';

export interface ReviewsSubject {
  media: ReviewedMedia;
  community: CommunityScore;
}

export function toReviewsSubject(
  details: MovieDetails | ShowDetails,
  type: MediaType,
): ReviewsSubject {
  return {
    media: { mediaItemId: details.id, type, slug: details.slug, title: details.title },
    community: {
      averageScore: scoreFromPercent(details.stats?.communityAverageRating),
      ratingCount: details.stats?.communityRatingCount ?? 0,
    },
  };
}
