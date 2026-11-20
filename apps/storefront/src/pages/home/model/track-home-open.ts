import type { MediaType } from '@/shared/api';
import { track } from '@/shared/lib';

type HomeBlock =
  | 'home_hero'
  | 'home_top_picks'
  | 'home_top_ten'
  | 'home_episodes'
  | 'home_releases'
  | 'home_upcoming';

export function trackHomeOpen(origin: HomeBlock, mediaType: MediaType): void {
  track('open_title', { origin, media_type: mediaType, in_catalog: true });
}
