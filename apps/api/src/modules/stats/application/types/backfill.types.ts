import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Item in a backfill chunk.
 * Used for processing watchers backfill in batches via BullMQ.
 */
export interface BackfillChunkItem {
  id: string;
  tmdbId: number;
  type: MediaType;
}
