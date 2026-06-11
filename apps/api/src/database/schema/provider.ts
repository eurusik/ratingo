import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';

import { DEFAULT_PROVIDER_PRIORITY } from '../../common/constants/provider.constants';

import { mediaItems } from './media';

// Distribution channel enum for provider system
export const distributionChannelEnum = pgEnum('distribution_channel', [
  'direct',
  'amazon_channel',
  'apple_tv_channel',
]);

// Offer type enum for provider system
export const offerTypeEnum = pgEnum('offer_type', ['flatrate', 'rent', 'buy', 'ads', 'free']);

// --- PROVIDER SYSTEM ---

/**
 * PROVIDER REGISTRY
 * Canonical provider brands (netflix, prime_video, disney_plus, etc.)
 * Primary key is text ID for human-readable references in policies.
 */
export const providerRegistry = pgTable('provider_registry', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
  brandGroup: text('brand_group'),
  logoPath: text('logo_path'),
  priority: integer('priority').default(DEFAULT_PROVIDER_PRIORITY),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * PROVIDER VARIANTS
 * Provider tiers (standard, with ads, premium).
 * Phase 2 feature - tables created now for schema completeness.
 */
export const providerVariants = pgTable(
  'provider_variants',
  {
    id: text('id').primaryKey(),
    providerId: text('provider_id')
      .references(() => providerRegistry.id)
      .notNull(),
    displayLabel: text('display_label'),
    isAdsTier: boolean('is_ads_tier').default(false),
    isPremiumTier: boolean('is_premium_tier').default(false),
    priority: integer('priority').default(0),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    providerIdx: index('provider_variants_provider_idx').on(t.providerId),
  }),
);

/**
 * PROVIDER MAPPINGS
 * TMDB provider ID to canonical provider mapping.
 * Supports region-specific overrides (region='global' for worldwide).
 */
export const providerMappings = pgTable(
  'provider_mappings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tmdbProviderId: integer('tmdb_provider_id').notNull(),
    providerId: text('provider_id')
      .references(() => providerRegistry.id)
      .notNull(),
    variantId: text('variant_id').references(() => providerVariants.id),
    distributionChannel: distributionChannelEnum('distribution_channel')
      .default('direct')
      .notNull(),
    region: text('region').default('global').notNull(),
    notes: text('notes'),
    source: text('source').default('manual'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    tmdbRegionUniq: uniqueIndex('provider_mappings_tmdb_region_uniq').on(
      t.tmdbProviderId,
      t.region,
    ),
    tmdbIdx: index('provider_mappings_tmdb_idx').on(t.tmdbProviderId),
  }),
);

/**
 * PROVIDER UNMAPPED
 * Tracking unmapped TMDB provider IDs for admin review.
 * Primary key is tmdb_provider_id for efficient upserts.
 */
export const providerUnmapped = pgTable('provider_unmapped', {
  tmdbProviderId: integer('tmdb_provider_id').primaryKey(),
  lastSeenName: text('last_seen_name').notNull(),
  sampleNames: text('sample_names').array().default([]),
  firstSeenAt: timestamp('first_seen_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  seenCount: integer('seen_count').default(1).notNull(),
  sampleRegions: text('sample_regions').array().default([]),
});

/**
 * MEDIA WATCH OFFERS
 * Normalized watch availability records.
 * Each row represents one offer (provider + variant + channel + type) per region.
 * tmdb_provider_id preserved for traceability and re-normalization.
 */
export const mediaWatchOffers = pgTable(
  'media_watch_offers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    providerId: text('provider_id')
      .references(() => providerRegistry.id)
      .notNull(),
    variantId: text('variant_id').references(() => providerVariants.id),
    distributionChannel: distributionChannelEnum('distribution_channel')
      .default('direct')
      .notNull(),
    offerType: offerTypeEnum('offer_type').notNull(),
    region: text('region').notNull(),
    link: text('link'),
    tmdbProviderId: integer('tmdb_provider_id').notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    mediaIdx: index('media_watch_offers_media_idx').on(t.mediaItemId),
    providerIdx: index('media_watch_offers_provider_idx').on(t.providerId),
    offerTypeIdx: index('media_watch_offers_offer_type_idx').on(t.offerType),
    regionIdx: index('media_watch_offers_region_idx').on(t.region),
    providerOfferIdx: index('media_watch_offers_provider_offer_idx').on(t.providerId, t.offerType),
    tmdbIdx: index('media_watch_offers_tmdb_idx').on(t.tmdbProviderId),
    // Note: Unique constraint with COALESCE for variant_id created via raw SQL migration:
    // CREATE UNIQUE INDEX media_watch_offers_uniq ON media_watch_offers (
    //   media_item_id, provider_id, COALESCE(variant_id, 'standard'),
    //   distribution_channel, offer_type, region
    // );
  }),
);

// --- PROVIDER SYSTEM RELATIONS ---

export const providerRegistryRelations = relations(providerRegistry, ({ many }) => ({
  variants: many(providerVariants),
  mappings: many(providerMappings),
  offers: many(mediaWatchOffers),
}));

export const providerVariantsRelations = relations(providerVariants, ({ one, many }) => ({
  provider: one(providerRegistry, {
    fields: [providerVariants.providerId],
    references: [providerRegistry.id],
  }),
  mappings: many(providerMappings),
  offers: many(mediaWatchOffers),
}));

export const providerMappingsRelations = relations(providerMappings, ({ one }) => ({
  provider: one(providerRegistry, {
    fields: [providerMappings.providerId],
    references: [providerRegistry.id],
  }),
  variant: one(providerVariants, {
    fields: [providerMappings.variantId],
    references: [providerVariants.id],
  }),
}));

export const mediaWatchOffersRelations = relations(mediaWatchOffers, ({ one }) => ({
  media: one(mediaItems, {
    fields: [mediaWatchOffers.mediaItemId],
    references: [mediaItems.id],
  }),
  provider: one(providerRegistry, {
    fields: [mediaWatchOffers.providerId],
    references: [providerRegistry.id],
  }),
  variant: one(providerVariants, {
    fields: [mediaWatchOffers.variantId],
    references: [providerVariants.id],
  }),
}));
