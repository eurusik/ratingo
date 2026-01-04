/**
 * Provider System Domain Types
 *
 * Core types for the normalized provider registry system.
 */

/** Distribution channel values */
export const DISTRIBUTION_CHANNEL = {
  DIRECT: 'direct',
  AMAZON_CHANNEL: 'amazon_channel',
  APPLE_TV_CHANNEL: 'apple_tv_channel',
} as const;

/** Distribution channel - how content is accessed */
export type DistributionChannel = (typeof DISTRIBUTION_CHANNEL)[keyof typeof DISTRIBUTION_CHANNEL];

/** Offer type values */
export const OFFER_TYPE = {
  FLATRATE: 'flatrate',
  RENT: 'rent',
  BUY: 'buy',
  ADS: 'ads',
  FREE: 'free',
} as const;

/** Offer type - type of availability */
export type OfferType = (typeof OFFER_TYPE)[keyof typeof OFFER_TYPE];

/** Mapping source values */
export const MAPPING_SOURCE = {
  MANUAL: 'manual',
  INFERRED: 'inferred',
} as const;

/** Mapping source - how the mapping was created */
export type MappingSource = (typeof MAPPING_SOURCE)[keyof typeof MAPPING_SOURCE];

/**
 * Canonical provider brand from provider_registry.
 */
export interface Provider {
  id: string;
  displayName: string;
  brandGroup: string | null;
  logoPath: string | null;
  priority: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Provider variant/tier from provider_variants.
 */
export interface ProviderVariant {
  id: string;
  providerId: string;
  displayLabel: string | null;
  isAdsTier: boolean;
  isPremiumTier: boolean;
  priority: number;
  createdAt: Date;
}

/**
 * TMDB ID to canonical provider mapping from provider_mappings.
 */
export interface ProviderMapping {
  id: string;
  tmdbProviderId: number;
  providerId: string;
  variantId: string | null;
  distributionChannel: DistributionChannel;
  region: string;
  notes: string | null;
  source: MappingSource;
  createdAt: Date;
}

/**
 * Unmapped TMDB provider tracking from provider_unmapped.
 */
export interface UnmappedProvider {
  tmdbProviderId: number;
  lastSeenName: string;
  sampleNames: string[];
  firstSeenAt: Date;
  lastSeenAt: Date;
  seenCount: number;
  sampleRegions: string[];
}

/**
 * Normalized watch offer from media_watch_offers.
 */
export interface MediaWatchOffer {
  id: string;
  mediaItemId: string;
  providerId: string;
  variantId: string | null;
  distributionChannel: DistributionChannel;
  offerType: OfferType;
  region: string;
  link: string | null;
  tmdbProviderId: number;
  updatedAt: Date;
}

/**
 * Resolved mapping result from cache/DB lookup.
 */
export interface ResolvedMapping {
  providerId: string;
  variantId: string | null;
  distributionChannel: DistributionChannel;
}

/**
 * Provider with variants for full provider info.
 */
export interface ProviderWithVariants extends Provider {
  variants: ProviderVariant[];
}

/**
 * Create provider DTO.
 */
export interface CreateProviderDto {
  id: string;
  displayName: string;
  brandGroup?: string | null;
  logoPath?: string | null;
  priority?: number;
}

/**
 * Update provider DTO.
 */
export interface UpdateProviderDto {
  displayName?: string;
  brandGroup?: string | null;
  logoPath?: string | null;
  priority?: number;
  isActive?: boolean;
}

/**
 * Create mapping DTO.
 */
export interface CreateMappingDto {
  tmdbProviderId: number;
  providerId: string;
  variantId?: string | null;
  distributionChannel?: DistributionChannel;
  region?: string;
  notes?: string | null;
  source?: MappingSource;
}

/**
 * Update mapping DTO.
 */
export interface UpdateMappingDto {
  providerId?: string;
  variantId?: string | null;
  distributionChannel?: DistributionChannel;
  notes?: string | null;
}
