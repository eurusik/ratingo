import { type VideoData } from '@/modules/catalog/domain/types/common.types';

export function extractPrimaryTrailer(videos: unknown): VideoData | null {
  if (!Array.isArray(videos)) return null;
  const first: unknown = videos[0];
  return first ? (first as VideoData) : null;
}
