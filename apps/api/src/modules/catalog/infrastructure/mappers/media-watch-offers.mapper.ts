import {
  PRIMARY_REGION,
  FALLBACK_REGION,
  type AvailabilityRegion,
} from '../../../../common/constants/region.constants';
import { ImageMapper } from '../../../../common/mappers/image.mapper';
import type { AvailabilityData, WatchProvider } from '../../domain/types/common.types';

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
   *
   * @param offers - Rows from media_watch_offers JOIN provider_registry
   * @returns AvailabilityData or null if no offers
   */
  static toAvailability(offers: WatchOfferRow[]): AvailabilityData | null {
    if (!offers || offers.length === 0) return null;

    // Group by region
    const byRegion = new Map<string, WatchOfferRow[]>();
    for (const offer of offers) {
      const region = offer.region.toUpperCase();
      if (!byRegion.has(region)) {
        byRegion.set(region, []);
      }
      byRegion.get(region)!.push(offer);
    }

    // Try UA first
    const uaOffers = byRegion.get(PRIMARY_REGION);
    if (uaOffers && uaOffers.length > 0) {
      return {
        region: PRIMARY_REGION as AvailabilityRegion,
        isFallback: false,
        ...this.groupByOfferType(uaOffers),
      };
    }

    // Fallback to US
    const usOffers = byRegion.get(FALLBACK_REGION);
    if (usOffers && usOffers.length > 0) {
      return {
        region: FALLBACK_REGION as AvailabilityRegion,
        isFallback: true,
        ...this.groupByOfferType(usOffers),
      };
    }

    return null;
  }

  /**
   * Groups offers by type and maps to WatchProvider arrays.
   */
  private static groupByOfferType(
    offers: WatchOfferRow[],
  ): Omit<AvailabilityData, 'region' | 'isFallback'> {
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
