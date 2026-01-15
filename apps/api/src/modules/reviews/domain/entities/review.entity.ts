/**
 * Review entity - user's short review of a movie or show.
 */
export interface Review {
  id: string;
  userId: string;
  mediaItemId: string;
  content: string;
  rating: number; // 0-100
  hasSpoiler: boolean;
  isDeleted: boolean;
  likesCount: number;
  dislikesCount: number;
  repliesCount: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

/**
 * Review with author information for display.
 */
export interface ReviewWithAuthor extends Review {
  author: {
    id: string;
    username: string;
    avatarUrl: string | null;
    showRatings: boolean;
    isProfilePublic: boolean;
  };
}

/**
 * Input for creating a new review.
 */
export interface CreateReviewInput {
  userId: string;
  mediaItemId: string;
  content: string;
  rating: number;
  hasSpoiler: boolean;
}

/**
 * Input for updating an existing review.
 */
export interface UpdateReviewInput {
  content?: string;
  rating?: number;
  hasSpoiler?: boolean;
}
