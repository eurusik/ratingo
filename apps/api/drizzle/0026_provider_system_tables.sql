-- Migration: Provider System Tables
-- Purpose: Normalized provider registry, mappings, and watch offers

-- Step 1: Create enums
CREATE TYPE "distribution_channel" AS ENUM ('direct', 'amazon_channel', 'apple_tv_channel');
CREATE TYPE "offer_type" AS ENUM ('flatrate', 'rent', 'buy', 'ads', 'free');

-- Step 2: Create provider_registry table
CREATE TABLE "provider_registry" (
  "id" text PRIMARY KEY NOT NULL,
  "display_name" text NOT NULL,
  "brand_group" text,
  "logo_path" text,
  "priority" integer DEFAULT 100,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Step 3: Create provider_variants table
CREATE TABLE "provider_variants" (
  "id" text PRIMARY KEY NOT NULL,
  "provider_id" text NOT NULL,
  "display_label" text,
  "is_ads_tier" boolean DEFAULT false,
  "is_premium_tier" boolean DEFAULT false,
  "priority" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "provider_variants" 
  ADD CONSTRAINT "provider_variants_provider_id_provider_registry_id_fk" 
  FOREIGN KEY ("provider_id") REFERENCES "provider_registry"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "provider_variants_provider_idx" ON "provider_variants" USING btree ("provider_id");

-- Step 4: Create provider_mappings table
CREATE TABLE "provider_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_provider_id" integer NOT NULL,
  "provider_id" text NOT NULL,
  "variant_id" text,
  "distribution_channel" "distribution_channel" DEFAULT 'direct' NOT NULL,
  "region" text DEFAULT 'global' NOT NULL,
  "notes" text,
  "source" text DEFAULT 'manual',
  "created_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "provider_mappings" 
  ADD CONSTRAINT "provider_mappings_provider_id_provider_registry_id_fk" 
  FOREIGN KEY ("provider_id") REFERENCES "provider_registry"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "provider_mappings" 
  ADD CONSTRAINT "provider_mappings_variant_id_provider_variants_id_fk" 
  FOREIGN KEY ("variant_id") REFERENCES "provider_variants"("id") ON DELETE no action ON UPDATE no action;

CREATE UNIQUE INDEX "provider_mappings_tmdb_region_uniq" ON "provider_mappings" USING btree ("tmdb_provider_id", "region");
CREATE INDEX "provider_mappings_tmdb_idx" ON "provider_mappings" USING btree ("tmdb_provider_id");

-- Step 5: Create provider_unmapped table
CREATE TABLE "provider_unmapped" (
  "tmdb_provider_id" integer PRIMARY KEY NOT NULL,
  "last_seen_name" text NOT NULL,
  "sample_names" text[] DEFAULT '{}',
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "seen_count" integer DEFAULT 1 NOT NULL,
  "sample_regions" text[] DEFAULT '{}'
);

-- Step 6: Create media_watch_offers table
CREATE TABLE "media_watch_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid NOT NULL,
  "provider_id" text NOT NULL,
  "variant_id" text,
  "distribution_channel" "distribution_channel" DEFAULT 'direct' NOT NULL,
  "offer_type" "offer_type" NOT NULL,
  "region" text NOT NULL,
  "link" text,
  "tmdb_provider_id" integer NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

ALTER TABLE "media_watch_offers" 
  ADD CONSTRAINT "media_watch_offers_media_item_id_media_items_id_fk" 
  FOREIGN KEY ("media_item_id") REFERENCES "media_items"("id") ON DELETE cascade ON UPDATE no action;

ALTER TABLE "media_watch_offers" 
  ADD CONSTRAINT "media_watch_offers_provider_id_provider_registry_id_fk" 
  FOREIGN KEY ("provider_id") REFERENCES "provider_registry"("id") ON DELETE no action ON UPDATE no action;

ALTER TABLE "media_watch_offers" 
  ADD CONSTRAINT "media_watch_offers_variant_id_provider_variants_id_fk" 
  FOREIGN KEY ("variant_id") REFERENCES "provider_variants"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "media_watch_offers_media_idx" ON "media_watch_offers" USING btree ("media_item_id");
CREATE INDEX "media_watch_offers_provider_idx" ON "media_watch_offers" USING btree ("provider_id");
CREATE INDEX "media_watch_offers_offer_type_idx" ON "media_watch_offers" USING btree ("offer_type");
CREATE INDEX "media_watch_offers_region_idx" ON "media_watch_offers" USING btree ("region");
CREATE INDEX "media_watch_offers_provider_offer_idx" ON "media_watch_offers" USING btree ("provider_id", "offer_type");
CREATE INDEX "media_watch_offers_tmdb_idx" ON "media_watch_offers" USING btree ("tmdb_provider_id");

-- Functional unique index with COALESCE for nullable variant_id
CREATE UNIQUE INDEX "media_watch_offers_uniq" ON "media_watch_offers" (
  "media_item_id",
  "provider_id",
  COALESCE("variant_id", 'standard'),
  "distribution_channel",
  "offer_type",
  "region"
);
