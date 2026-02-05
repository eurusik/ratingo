import {
  PRIMARY_REGION,
  FALLBACK_REGION,
  AVAILABILITY_REGIONS,
  type AvailabilityRegion,
} from '../../../../common/constants/region.constants';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import type { WatchProvidersMap } from '../../../ingestion/public';
import type {
  AvailabilityData,
  AvailabilityHint,
  WatchProvider,
} from '../../domain/types/common.types';

/** Fallback priority when provider has no priority set */
const DEFAULT_PRIORITY_FALLBACK = 999;

/** Bit shift for hash calculation (djb2-like algorithm) */
const HASH_SHIFT_BITS = 5;

/**
 * Offer row from media_watch_offers JOIN provider_registry.
 */
export interface WatchOfferRow {
  providerId: string;
  displayName: string;
  logoPath: string | null;
  priority: number | null;
  offerType: 'flatrate' | 'rent' | 'buy' | 'ads' | 'free';
  region: string;
  link: string | null;
}

/**
 * Maps normalized media_watch_offers to AvailabilityData for API response.
 *
 * Region priority: UA > US
 * Groups offers by type (stream/rent/buy/ads/free).
 */
export class MediaWatchOffersMapper {
  /**
   * Maps watch offer rows to AvailabilityData with region fallback logic.
   * Computes availability hint based on normalized offers and raw TMDB data.
   *
   * @param offers - Rows from media_watch_offers JOIN provider_registry
   * @param rawProviders - Raw TMDB watch providers for fallback hint computation
   * @returns AvailabilityData (never null - always returns with hint)
   */
  static toAvailability(
    offers: WatchOfferRow[],
    rawProviders?: WatchProvidersMap | null,
  ): AvailabilityData {
    // Group offers by region
    const byRegion = new Map<string, WatchOfferRow[]>();
    for (const offer of offers ?? []) {
      const region = offer.region.toUpperCase();
      if (!byRegion.has(region)) {
        byRegion.set(region, []);
      }
      byRegion.get(region)!.push(offer);
    }

    // Try UA first, then US
    const uaOffers = byRegion.get(PRIMARY_REGION);
    const usOffers = byRegion.get(FALLBACK_REGION);

    const selectedOffers = this.selectOffersByPriority(uaOffers, usOffers);
    const region = this.determineRegion(uaOffers, usOffers);
    const isFallback = !uaOffers?.length && !!usOffers?.length;

    if (selectedOffers) {
      const grouped = this.groupByOfferType(selectedOffers);
      const hasSvod = (grouped.stream?.length ?? 0) > 0 || (grouped.free?.length ?? 0) > 0;

      return {
        region,
        isFallback,
        hint: hasSvod ? 'svod' : 'tvod_only',
        ...grouped,
      };
    }

    // No normalized offers - compute fallback hint from raw data
    const { hint, tmdbWatchUrl } = this.computeFallbackHint(rawProviders);

    return {
      region: null,
      isFallback: false,
      link: null,
      hint,
      tmdbWatchUrl,
    };
  }

  /**
   * Selects offers by region priority (UA > US).
   */
  private static selectOffersByPriority(
    uaOffers: WatchOfferRow[] | undefined,
    usOffers: WatchOfferRow[] | undefined,
  ): WatchOfferRow[] | null {
    if (uaOffers?.length) return uaOffers;
    if (usOffers?.length) return usOffers;
    return null;
  }

  /**
   * Determines the region based on available offers.
   */
  private static determineRegion(
    uaOffers: WatchOfferRow[] | undefined,
    usOffers: WatchOfferRow[] | undefined,
  ): AvailabilityRegion | null {
    if (uaOffers?.length) return PRIMARY_REGION as AvailabilityRegion;
    if (usOffers?.length) return FALLBACK_REGION as AvailabilityRegion;
    return null;
  }

  /**
   * Computes availability hint from raw TMDB data when no normalized offers exist.
   * Checks if rent/buy exists in raw data for supported regions.
   */
  private static computeFallbackHint(rawProviders?: WatchProvidersMap | null): {
    hint: AvailabilityHint;
    tmdbWatchUrl: string | null;
  } {
    if (!rawProviders) {
      return { hint: 'none', tmdbWatchUrl: null };
    }

    let hasTvod = false;
    let tmdbWatchUrl: string | null = null;

    // Check supported regions (UA, US) for rent/buy
    for (const regionCode of AVAILABILITY_REGIONS) {
      const regionData = rawProviders[regionCode] ?? rawProviders[regionCode.toLowerCase()];
      if (!regionData) continue;

      // Capture TMDB watch URL
      if (!tmdbWatchUrl && regionData.link) {
        tmdbWatchUrl = regionData.link;
      }

      // Check for rent/buy
      if (regionData.rent?.length || regionData.buy?.length) {
        hasTvod = true;
      }
    }

    return {
      hint: hasTvod ? 'tvod_only' : 'none',
      tmdbWatchUrl,
    };
  }

  /**
   * Groups offers by type and maps to WatchProvider arrays.
   */
  private static groupByOfferType(
    offers: WatchOfferRow[],
  ): Omit<AvailabilityData, 'region' | 'isFallback' | 'hint' | 'tmdbWatchUrl'> {
    const stream: WatchProvider[] = [];
    const rent: WatchProvider[] = [];
    const buy: WatchProvider[] = [];
    const ads: WatchProvider[] = [];
    const free: WatchProvider[] = [];
    let link: string | null = null;

    // Dedupe by providerId per type (same provider can appear once per type)
    const seen = new Set<string>();

    // Sort by priority (lower = higher priority)
    const sorted = [...offers].sort(
      (a, b) =>
        (a.priority ?? DEFAULT_PRIORITY_FALLBACK) - (b.priority ?? DEFAULT_PRIORITY_FALLBACK),
    );

    for (const offer of sorted) {
      const key = `${offer.offerType}:${offer.providerId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const provider = this.mapProvider(offer);
      const { link: offerLink } = offer;

      // Capture first link
      if (!link && offerLink) {
        link = offerLink;
      }

      switch (offer.offerType) {
        case 'flatrate':
          stream.push(provider);
          break;
        case 'rent':
          rent.push(provider);
          break;
        case 'buy':
          buy.push(provider);
          break;
        case 'ads':
          ads.push(provider);
          break;
        case 'free':
          free.push(provider);
          break;
      }
    }

    return {
      link,
      stream: stream.length > 0 ? stream : undefined,
      rent: rent.length > 0 ? rent : undefined,
      buy: buy.length > 0 ? buy : undefined,
      ads: ads.length > 0 ? ads : undefined,
      free: free.length > 0 ? free : undefined,
    };
  }

  /**
   * Maps offer row to WatchProvider.
   * Returns both canonical string ID and numeric hash for backward compatibility.
   */
  private static mapProvider(offer: WatchOfferRow): WatchProvider {
    return {
      id: offer.providerId,
      // Numeric hash for backward compatibility with existing UI
      providerId: this.hashProviderId(offer.providerId),
      name: offer.displayName,
      logo: ImageMapper.toPoster(offer.logoPath),
      displayPriority: offer.priority ?? undefined,
    };
  }

  /**
   * Generates stable numeric ID from string providerId.
   * This maintains compatibility with existing UI that expects numeric IDs.
   */
  private static hashProviderId(id: string): number {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      const char = id.charCodeAt(i);
      hash = (hash << HASH_SHIFT_BITS) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }
}
