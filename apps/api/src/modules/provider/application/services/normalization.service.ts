/**
 * Normalization Service
 *
 * Converts raw TMDB watch provider data to normalized offers.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CreateWatchOfferInput,
  IMediaWatchOffersRepository,
  MEDIA_WATCH_OFFERS_REPOSITORY,
} from '../../domain/repositories/media-watch-offers.repository.interface';
import {
  IUnmappedTrackingRepository,
  RecordUnmappedInput,
  UNMAPPED_TRACKING_REPOSITORY,
} from '../../domain/repositories/unmapped-tracking.repository.interface';
import type { OfferType } from '../../domain/types/provider.types';
import { normalizeRegion } from '../../domain/utils/region-normalizer';

import { ProviderMappingService } from './provider-mapping.service';

/** Raw TMDB provider data */
export interface TmdbProvider {
  provider_id: number;
  provider_name: string;
  logo_path?: string;
  display_priority?: number;
}

/** Raw TMDB region data */
export interface TmdbRegionData {
  link?: string;
  flatrate?: TmdbProvider[];
  rent?: TmdbProvider[];
  buy?: TmdbProvider[];
  ads?: TmdbProvider[];
  free?: TmdbProvider[];
}

/** Raw TMDB watch providers map (region code → data) */
export type WatchProvidersMap = Record<string, TmdbRegionData>;

/** Result of normalization for a single media item */
export interface NormalizationResult {
  mediaItemId: string;
  offersCreated: number;
  unmappedCount: number;
}

/** Result of batch normalization */
export interface BatchNormalizationResult {
  processed: number;
  offersCreated: number;
  errors: number;
  unmappedTotal: number;
}

/** Offer types to process from TMDB data */
const OFFER_TYPES: OfferType[] = ['flatrate', 'rent', 'buy', 'ads', 'free'];

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);

  constructor(
    private readonly mappingService: ProviderMappingService,
    @Inject(MEDIA_WATCH_OFFERS_REPOSITORY)
    private readonly offersRepository: IMediaWatchOffersRepository,
    @Inject(UNMAPPED_TRACKING_REPOSITORY)
    private readonly unmappedRepository: IUnmappedTrackingRepository,
  ) {}

  /**
   * Normalizes watch providers for a single media item.
   * Resolves TMDB IDs to canonical providers and creates offers.
   */
  async normalizeWatchProviders(
    mediaItemId: string,
    rawProviders: WatchProvidersMap,
  ): Promise<NormalizationResult> {
    const offers: CreateWatchOfferInput[] = [];
    const unmapped: RecordUnmappedInput[] = [];

    // Collect TMDB provider IDs per region for batch resolution
    const idsByRegion = this.collectIdsByRegion(rawProviders);

    // Batch resolve mappings per region
    const mappingsByRegion = await this.resolveMappingsByRegion(idsByRegion);

    // Process each region
    for (const [rawRegion, regionData] of Object.entries(rawProviders)) {
      const region = normalizeRegion(rawRegion);
      const link = regionData.link ?? null;
      const regionMappings = mappingsByRegion.get(region) ?? new Map();

      this.processRegionOffers(
        mediaItemId,
        regionData,
        region,
        link,
        regionMappings,
        offers,
        unmapped,
      );
    }

    // Persist offers
    if (offers.length > 0) {
      await this.offersRepository.upsertManyByRegions(mediaItemId, offers);
    }

    // Record unmapped providers
    if (unmapped.length > 0) {
      await this.unmappedRepository.recordUnmappedBatch(unmapped);
      this.logger.debug(`Media ${mediaItemId}: ${unmapped.length} unmapped providers recorded`);
    }

    this.logger.debug(
      `Normalized media=${mediaItemId}: offers=${offers.length} unmapped=${unmapped.length}`,
    );

    return {
      mediaItemId,
      offersCreated: offers.length,
      unmappedCount: unmapped.length,
    };
  }

  /**
   * Normalizes watch providers for multiple media items (batch/backfill).
   */
  async normalizeBatch(
    items: Array<{ mediaItemId: string; rawProviders: WatchProvidersMap }>,
  ): Promise<BatchNormalizationResult> {
    let processed = 0;
    let offersCreated = 0;
    let errors = 0;
    let unmappedTotal = 0;

    for (const item of items) {
      try {
        const result = await this.normalizeWatchProviders(item.mediaItemId, item.rawProviders);
        processed++;
        offersCreated += result.offersCreated;
        unmappedTotal += result.unmappedCount;
      } catch (error) {
        errors++;
        this.logger.error(
          `Failed to normalize media=${item.mediaItemId}`,
          error instanceof Error ? error.stack : error,
        );
      }
    }

    this.logger.log(
      `Batch normalization: processed=${processed} offers=${offersCreated} errors=${errors} unmapped=${unmappedTotal}`,
    );

    return {
      processed,
      offersCreated,
      errors,
      unmappedTotal,
    };
  }

  /**
   * Processes all offer types for a single region.
   */
  private processRegionOffers(
    mediaItemId: string,
    regionData: TmdbRegionData,
    region: string,
    link: string | null,
    regionMappings: Map<number, ResolvedMappingInternal>,
    offers: CreateWatchOfferInput[],
    unmapped: RecordUnmappedInput[],
  ): void {
    for (const offerType of OFFER_TYPES) {
      const providers = regionData[offerType] ?? [];

      for (const provider of providers) {
        const mapping = regionMappings.get(provider.provider_id);

        if (mapping) {
          offers.push({
            mediaItemId,
            providerId: mapping.providerId,
            variantId: mapping.variantId,
            distributionChannel: mapping.distributionChannel,
            offerType,
            region,
            link,
            tmdbProviderId: provider.provider_id,
          });
        } else {
          unmapped.push({
            tmdbProviderId: provider.provider_id,
            providerName: provider.provider_name,
            region,
          });
        }
      }
    }
  }

  /**
   * Collects TMDB provider IDs grouped by region.
   */
  private collectIdsByRegion(rawProviders: WatchProvidersMap): Map<string, Set<number>> {
    const idsByRegion = new Map<string, Set<number>>();

    for (const [rawRegion, regionData] of Object.entries(rawProviders)) {
      const region = normalizeRegion(rawRegion);
      const ids = idsByRegion.get(region) ?? new Set<number>();

      for (const offerType of OFFER_TYPES) {
        const providers = regionData[offerType] ?? [];
        for (const provider of providers) {
          ids.add(provider.provider_id);
        }
      }

      if (ids.size > 0) {
        idsByRegion.set(region, ids);
      }
    }

    return idsByRegion;
  }

  /**
   * Resolves mappings for all regions using batch queries.
   */
  private async resolveMappingsByRegion(
    idsByRegion: Map<string, Set<number>>,
  ): Promise<Map<string, Map<number, ResolvedMappingInternal>>> {
    const mappingsByRegion = new Map<string, Map<number, ResolvedMappingInternal>>();

    for (const [region, ids] of idsByRegion) {
      const mappings = await this.mappingService.resolveMany([...ids], region);
      mappingsByRegion.set(region, mappings);
    }

    return mappingsByRegion;
  }
}

/** Internal type matching ResolvedMapping from MappingService */
interface ResolvedMappingInternal {
  providerId: string;
  variantId: string | null;
  distributionChannel: 'direct' | 'amazon_channel' | 'apple_tv_channel';
}
