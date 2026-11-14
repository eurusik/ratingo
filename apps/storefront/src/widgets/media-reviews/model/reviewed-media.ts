import type { MediaType } from '@/shared/api';

export interface ReviewedMedia {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
}

export interface CommunityScore {
  averageScore?: number;
  ratingCount: number;
}
