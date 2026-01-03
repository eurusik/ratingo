/**
 * Media Watch Offers Repository Interface
 *
 * Port for managing normalized watch offers.
 */

import type { DistributionChannel, MediaWatchOffer, OfferType } from '../types/provider.types';

export const MEDIA_WATCH_OFFERS_REPOSITORY = Symbol('MEDIA_WATCH_OFFERS_REPOSITORY');

/** Input for creating a watch offer */
export interface CreateWatchOfferInput {
  mediaItemId: string;
  providerId: string;
  variantId: string | null;
  distributionChannel: DistributionChannel;
  offerType: OfferType;
  region: string;
  link: string | null;
  tmdbProviderId: number;
}

/** Options for querying offers */
export interface FindOffersOptions {
  offerTypes?: OfferType[];
  distributionChannels?: DistributionChannel[];
  region?: string;
}

/** Options for batch query with policy filtering */
export interface GetOffersForMediaBatchOptions {
  offerTypes?: OfferType[];
  distributionChannels?: DistributionChannel[];
  /**
   * When true, performs LEFT JOIN with provider_variants
   * and includes variantIsAdsTier in result for ads tier filtering.
   */
  includeVariantInfo?: boolean;
}

/**
 * Media watch offer view for policy evaluation.
 * Minimal projection with optional variant info.
 */
export interface MediaWatchOfferView {
  providerId: string;
  offerType: OfferType;
  distributionChannel: DistributionChannel;
  /** Present only when includeVariantInfo = true */
  variantIsAdsTier?: boolean;
}

/**
 * Repository for normalized media watch offers.
 * Implemented by: MediaWatchOffersRepository
 */
export interface IMediaWatchOffersRepository {
  /**
   * Upserts multiple offers for a media item.
   * Uses replace-per-region strategy: DELETE existing for region, then INSERT.
   */
  upsertMany(mediaItemId: string, region: string, offers: CreateWatchOfferInput[]): Promise<void>;

  /**
   * Upserts offers across multiple regions for a media item.
   * Groups by region and calls upsertMany for each.
   */
  upsertManyByRegions(mediaItemId: string, offers: CreateWatchOfferInput[]): Promise<void>;

  /**
   * Finds all offers for a media item.
   */
  findByMediaItemId(mediaItemId: string, options?: FindOffersOptions): Promise<MediaWatchOffer[]>;

  /**
   * Finds all offers by TMDB provider ID (for re-normalization).
   */
  findByTmdbProviderId(tmdbProviderId: number): Promise<MediaWatchOffer[]>;

  /**
   * Finds offers for multiple media items (batch query for policy evaluation).
   */
  findByMediaItemIds(
    mediaItemIds: string[],
    options?: FindOffersOptions,
  ): Promise<Map<string, MediaWatchOffer[]>>;

  /**
   * Batch query for policy evaluation with optional variant info.
   * No N+1 queries - single query with optional JOIN.
   *
   * @param mediaItemIds - Media item IDs to query
   * @param options - Query options including variant info flag
   * @returns Map of mediaItemId → offer views
   */
  getOffersForMediaBatch(
    mediaItemIds: string[],
    options?: GetOffersForMediaBatchOptions,
  ): Promise<Map<string, MediaWatchOfferView[]>>;

  /**
   * Deletes all offers for a media item.
   */
  deleteByMediaItemId(mediaItemId: string): Promise<void>;

  /**
   * Deletes offers for a media item in a specific region.
   */
  deleteByMediaItemIdAndRegion(mediaItemId: string, region: string): Promise<void>;
}
