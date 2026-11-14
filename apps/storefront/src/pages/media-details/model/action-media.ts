import type { Season } from '@/entities/episode';
import type { MediaType } from '@/shared/api';

export interface ActionMedia {
  mediaItemId: string;
  type: MediaType;
  slug: string;
  title: string;
  showId?: string;
  seasons?: Season[];
  seasonCount?: number;
  episodeCount?: number;
}
