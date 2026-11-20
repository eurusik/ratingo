import type { MediaType } from '@/shared/api';
import { track, type HomeBlock } from '@/shared/lib';

interface HomeOpen {
  origin: HomeBlock;
  mediaType: MediaType;
  position: number;
  list?: string;
}

export function trackHomeOpen({ origin, mediaType, position, list }: HomeOpen): void {
  track('open_title', { origin, media_type: mediaType, in_catalog: true, position, list });
}
