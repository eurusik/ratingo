import { type Credits } from '../../../ingestion/public';

export const PERSON_CREDITS_WRITER = Symbol('PERSON_CREDITS_WRITER');

/**
 * Cross-module capability: normalize a media item's credits JSONB into the
 * persons / media_credits read-model. Consumed by the ingestion pipeline and
 * the backfill job.
 */
export interface IPersonCreditsWriter {
  writeFromCredits(mediaItemId: string, credits: Credits | null): Promise<void>;
}
