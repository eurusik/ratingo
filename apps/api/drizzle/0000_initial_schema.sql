-- Migration: Initial Schema
-- Creates all base tables required for the application

-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE "public"."media_type" AS ENUM('movie', 'show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."user_media_status" AS ENUM('watching', 'completed', 'planned', 'dropped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."ingestion_status" AS ENUM('importing', 'ready', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."eligibility_status" AS ENUM('pending', 'eligible', 'ineligible', 'review');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."evaluation_run_status" AS ENUM('running', 'prepared', 'failed', 'cancelled', 'promoted', 'pending', 'completed', 'success');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."content_class" AS ENUM('mainstream', 'anime', 'documentary', 'reality', 'kids');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."distribution_channel" AS ENUM('direct', 'amazon_channel', 'apple_tv_channel');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."offer_type" AS ENUM('flatrate', 'rent', 'buy', 'ads', 'free');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."saved_item_list" AS ENUM('for_later', 'considering');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."evaluation_context" AS ENUM('catalog', 'trending', 'homepage', 'now_playing', 'new_digital', 'search');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."subscription_trigger" AS ENUM('release', 'new_season', 'new_episode', 'on_streaming', 'status_changed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- GENRES
-- ============================================================

CREATE TABLE IF NOT EXISTS "genres" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_id" integer UNIQUE NOT NULL,
  "name" text NOT NULL,
  "slug" text UNIQUE NOT NULL
);

-- ============================================================
-- MEDIA ITEMS (Base Table)
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "type" "media_type" NOT NULL,
  "tmdb_id" integer NOT NULL,
  "imdb_id" text,
  "title" text NOT NULL,
  "original_title" text,
  "slug" text UNIQUE NOT NULL,
  "overview" text,
  "poster_path" text,
  "backdrop_path" text,
  "videos" jsonb DEFAULT null,
  "credits" jsonb DEFAULT '{"cast":[],"crew":[]}',
  "watch_providers_raw" jsonb DEFAULT null,
  "trending_score" double precision DEFAULT 0,
  "trending_rank" integer,
  "trending_updated_at" timestamp,
  "popularity" double precision DEFAULT 0,
  "rating" double precision DEFAULT 0,
  "vote_count" integer DEFAULT 0,
  "rating_imdb" double precision,
  "vote_count_imdb" integer,
  "rating_metacritic" integer,
  "rating_rotten_tomatoes" integer,
  "rating_trakt" double precision,
  "vote_count_trakt" integer,
  "release_date" timestamp,
  "origin_countries" jsonb DEFAULT null,
  "original_language" text,
  "ingestion_status" "ingestion_status" DEFAULT 'ready' NOT NULL,
  "content_class" "content_class" DEFAULT 'mainstream' NOT NULL,
  "search_vector" tsvector GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, '') || ' ' || coalesce(overview, ''))) STORED,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_type_tmdb_idx" ON "media_items" ("type", "tmdb_id");
CREATE INDEX IF NOT EXISTS "media_imdb_idx" ON "media_items" ("imdb_id");
CREATE INDEX IF NOT EXISTS "media_trending_idx" ON "media_items" ("trending_score");
CREATE INDEX IF NOT EXISTS "media_trending_rank_idx" ON "media_items" ("trending_rank");
CREATE INDEX IF NOT EXISTS "media_popularity_idx" ON "media_items" ("popularity");
CREATE INDEX IF NOT EXISTS "media_release_date_idx" ON "media_items" ("release_date");
CREATE UNIQUE INDEX IF NOT EXISTS "media_slug_idx" ON "media_items" ("slug");
CREATE INDEX IF NOT EXISTS "media_active_idx" ON "media_items" ("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "media_search_idx" ON "media_items" USING gin ("search_vector");
CREATE INDEX IF NOT EXISTS "media_content_class_idx" ON "media_items" ("content_class");
CREATE INDEX IF NOT EXISTS "media_title_trgm_idx" ON "media_items" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "media_original_title_trgm_idx" ON "media_items" USING gin ("original_title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "media_items_ingestion_status_idx" ON "media_items" ("ingestion_status") WHERE "deleted_at" IS NULL;

-- ============================================================
-- MEDIA GENRES (Junction)
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_genres" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "genre_id" uuid NOT NULL REFERENCES "genres"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_genres_uniq" ON "media_genres" ("media_item_id", "genre_id");
CREATE INDEX IF NOT EXISTS "media_genres_genre_idx" ON "media_genres" ("genre_id");

-- ============================================================
-- MEDIA STATS
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_stats" (
  "media_item_id" uuid PRIMARY KEY REFERENCES "media_items"("id") ON DELETE CASCADE,
  "watchers_count" integer DEFAULT 0,
  "total_watchers" integer DEFAULT 0,
  "trending_rank" integer,
  "popularity_24h" double precision,
  "ratingo_score" double precision,
  "quality_score" double precision,
  "popularity_score" double precision,
  "freshness_score" double precision,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_stats_ratingo_score_idx" ON "media_stats" ("ratingo_score");
CREATE INDEX IF NOT EXISTS "media_stats_watchers_idx" ON "media_stats" ("watchers_count");

-- ============================================================
-- MOVIES
-- ============================================================

CREATE TABLE IF NOT EXISTS "movies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid UNIQUE NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "runtime" integer,
  "budget" bigint,
  "revenue" bigint,
  "status" text,
  "theatrical_release_date" timestamp,
  "digital_release_date" timestamp,
  "is_now_playing" boolean DEFAULT false,
  "releases" jsonb
);

CREATE INDEX IF NOT EXISTS "movies_now_playing_idx" ON "movies" ("is_now_playing") WHERE "is_now_playing" = true;
CREATE INDEX IF NOT EXISTS "movies_theatrical_idx" ON "movies" ("theatrical_release_date");
CREATE INDEX IF NOT EXISTS "movies_digital_idx" ON "movies" ("digital_release_date");
CREATE INDEX IF NOT EXISTS "movies_media_item_idx" ON "movies" ("media_item_id");

-- ============================================================
-- SHOWS
-- ============================================================

CREATE TABLE IF NOT EXISTS "shows" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid UNIQUE NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "total_seasons" integer,
  "total_episodes" integer,
  "status" text,
  "last_air_date" timestamp,
  "next_air_date" timestamp,
  "drop_off_analysis" jsonb
);

-- ============================================================
-- SEASONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "seasons" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "show_id" uuid NOT NULL REFERENCES "shows"("id") ON DELETE CASCADE,
  "tmdb_id" integer,
  "number" integer NOT NULL,
  "name" text,
  "overview" text,
  "poster_path" text,
  "air_date" timestamp,
  "episode_count" integer DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS "seasons_show_number_uniq" ON "seasons" ("show_id", "number");
CREATE INDEX IF NOT EXISTS "seasons_show_idx" ON "seasons" ("show_id");

-- ============================================================
-- EPISODES
-- ============================================================

CREATE TABLE IF NOT EXISTS "episodes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "season_id" uuid NOT NULL REFERENCES "seasons"("id") ON DELETE CASCADE,
  "show_id" uuid NOT NULL REFERENCES "shows"("id") ON DELETE CASCADE,
  "tmdb_id" integer,
  "number" integer NOT NULL,
  "title" text,
  "overview" text,
  "air_date" timestamp,
  "runtime" integer,
  "still_path" text,
  "vote_average" double precision
);

CREATE UNIQUE INDEX IF NOT EXISTS "episodes_season_number_uniq" ON "episodes" ("season_id", "number");
CREATE INDEX IF NOT EXISTS "episodes_air_date_idx" ON "episodes" ("air_date");
CREATE INDEX IF NOT EXISTS "episodes_show_idx" ON "episodes" ("show_id");
CREATE INDEX IF NOT EXISTS "episodes_show_air_date_idx" ON "episodes" ("show_id", "air_date");

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text UNIQUE NOT NULL,
  "username" text UNIQUE NOT NULL,
  "password_hash" text,
  "avatar_url" text,
  "bio" text,
  "location" text,
  "website" text,
  "preferred_language" text,
  "preferred_region" text,
  "is_profile_public" boolean DEFAULT true,
  "show_watch_history" boolean DEFAULT true,
  "show_ratings" boolean DEFAULT true,
  "allow_followers" boolean DEFAULT true,
  "role" "user_role" DEFAULT 'user',
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "deleted_at" timestamp
);

-- ============================================================
-- USER MEDIA STATE
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_media_state" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "state" "user_media_status" NOT NULL,
  "rating" integer,
  "progress" jsonb DEFAULT null,
  "notes" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_media_state_user_media_uniq" ON "user_media_state" ("user_id", "media_item_id");
CREATE INDEX IF NOT EXISTS "user_media_state_user_idx" ON "user_media_state" ("user_id");
CREATE INDEX IF NOT EXISTS "user_media_state_media_idx" ON "user_media_state" ("media_item_id");

-- ============================================================
-- REFRESH TOKENS
-- ============================================================

CREATE TABLE IF NOT EXISTS "refresh_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "user_agent" text,
  "ip" text,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "refresh_tokens_user_idx" ON "refresh_tokens" ("user_id");
CREATE INDEX IF NOT EXISTS "refresh_tokens_expires_idx" ON "refresh_tokens" ("expires_at");

-- ============================================================
-- MEDIA WATCHERS SNAPSHOTS
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_watchers_snapshots" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "snapshot_date" timestamp NOT NULL,
  "total_watchers" integer NOT NULL,
  "region" text DEFAULT 'global'
);

CREATE UNIQUE INDEX IF NOT EXISTS "media_watchers_media_date_region_uniq" ON "media_watchers_snapshots" ("media_item_id", "snapshot_date", "region");
CREATE INDEX IF NOT EXISTS "media_watchers_date_idx" ON "media_watchers_snapshots" ("snapshot_date");

-- ============================================================
-- USER MEDIA ACTIONS (Event Log)
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_media_actions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "action" text NOT NULL,
  "context" text,
  "reason_key" text,
  "payload" jsonb DEFAULT null,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "user_media_actions_user_idx" ON "user_media_actions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_media_actions_media_idx" ON "user_media_actions" ("media_item_id");
CREATE INDEX IF NOT EXISTS "user_media_actions_action_idx" ON "user_media_actions" ("action");
CREATE INDEX IF NOT EXISTS "user_media_actions_created_at_idx" ON "user_media_actions" ("created_at");

-- ============================================================
-- USER SAVED ITEMS
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_saved_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "list" "saved_item_list" NOT NULL,
  "reason_key" varchar(64),
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_saved_items_user_media_list_uniq" ON "user_saved_items" ("user_id", "media_item_id", "list");
CREATE INDEX IF NOT EXISTS "user_saved_items_user_idx" ON "user_saved_items" ("user_id");
CREATE INDEX IF NOT EXISTS "user_saved_items_user_list_idx" ON "user_saved_items" ("user_id", "list");

-- ============================================================
-- USER SUBSCRIPTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "user_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "trigger" "subscription_trigger" NOT NULL,
  "channel" text DEFAULT 'push',
  "is_active" boolean DEFAULT true NOT NULL,
  "last_notified_at" timestamp,
  "last_notified_episode_key" text,
  "last_notified_season_number" integer,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_subscriptions_user_media_trigger_channel_uniq" ON "user_subscriptions" ("user_id", "media_item_id", "trigger", "channel");
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_idx" ON "user_subscriptions" ("user_id");
CREATE INDEX IF NOT EXISTS "user_subscriptions_user_active_idx" ON "user_subscriptions" ("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "user_subscriptions_trigger_idx" ON "user_subscriptions" ("trigger");

-- ============================================================
-- CATALOG POLICIES
-- ============================================================

CREATE TABLE IF NOT EXISTS "catalog_policies" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "version" integer NOT NULL,
  "is_active" boolean DEFAULT false NOT NULL,
  "policy" jsonb NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "activated_at" timestamp
);

CREATE INDEX IF NOT EXISTS "catalog_policies_version_idx" ON "catalog_policies" ("version");
-- Partial unique index for single active policy
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_policies_single_active" ON "catalog_policies" ((1)) WHERE "is_active" = true;

-- ============================================================
-- CATALOG EVALUATION RUNS
-- ============================================================

CREATE TABLE IF NOT EXISTS "catalog_evaluation_runs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "policy_version" integer NOT NULL,
  "status" "evaluation_run_status" DEFAULT 'pending' NOT NULL,
  "started_at" timestamp DEFAULT now() NOT NULL,
  "finished_at" timestamp,
  "cursor" text,
  "counters" jsonb DEFAULT '{"processed":0,"eligible":0,"ineligible":0,"review":0,"reasonBreakdown":{}}',
  "target_policy_id" uuid REFERENCES "catalog_policies"("id"),
  "target_policy_version" integer,
  "baseline_policy_version" integer,
  "total_ready_snapshot" integer DEFAULT 0,
  "snapshot_cutoff" timestamp,
  "processed" integer DEFAULT 0,
  "eligible" integer DEFAULT 0,
  "ineligible" integer DEFAULT 0,
  "pending" integer DEFAULT 0,
  "errors" integer DEFAULT 0,
  "error_sample" jsonb DEFAULT '[]',
  "promoted_at" timestamp,
  "promoted_by" text
);

CREATE INDEX IF NOT EXISTS "catalog_eval_runs_policy_version_idx" ON "catalog_evaluation_runs" ("policy_version");
CREATE INDEX IF NOT EXISTS "catalog_eval_runs_status_idx" ON "catalog_evaluation_runs" ("status");
CREATE INDEX IF NOT EXISTS "catalog_eval_runs_target_policy_idx" ON "catalog_evaluation_runs" ("target_policy_id");
CREATE UNIQUE INDEX IF NOT EXISTS "catalog_eval_runs_running_policy_uniq" ON "catalog_evaluation_runs" ("target_policy_id") WHERE "status" = 'running';

-- ============================================================
-- MEDIA CATALOG EVALUATIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS "media_catalog_evaluations" (
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "context" "evaluation_context" NOT NULL DEFAULT 'catalog',
  "status" "eligibility_status" DEFAULT 'pending' NOT NULL,
  "reasons" text[] DEFAULT '{}' NOT NULL,
  "relevance_score" integer DEFAULT 0 NOT NULL,
  "policy_version" integer DEFAULT 0 NOT NULL,
  "breakout_rule_id" text,
  "evaluated_at" timestamp,
  "run_id" uuid REFERENCES "catalog_evaluation_runs"("id") ON DELETE SET NULL,
  PRIMARY KEY ("media_item_id", "policy_version", "context")
);

CREATE INDEX IF NOT EXISTS "media_catalog_eval_status_idx" ON "media_catalog_evaluations" ("status");
CREATE INDEX IF NOT EXISTS "media_catalog_eval_status_relevance_idx" ON "media_catalog_evaluations" ("status", "relevance_score");
CREATE INDEX IF NOT EXISTS "media_catalog_eval_policy_version_idx" ON "media_catalog_evaluations" ("policy_version");
CREATE INDEX IF NOT EXISTS "media_catalog_eval_run_id_idx" ON "media_catalog_evaluations" ("run_id");
CREATE INDEX IF NOT EXISTS "media_catalog_eval_run_status_idx" ON "media_catalog_evaluations" ("run_id", "status") WHERE "run_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "media_catalog_eval_policy_status_relevance_idx" ON "media_catalog_evaluations" ("policy_version", "status", "relevance_score" DESC);
CREATE INDEX IF NOT EXISTS "media_catalog_eval_item_version_idx" ON "media_catalog_evaluations" ("media_item_id", "policy_version" DESC);
CREATE UNIQUE INDEX IF NOT EXISTS "media_catalog_eval_run_item_unique_idx" ON "media_catalog_evaluations" ("run_id", "media_item_id") WHERE "run_id" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "media_catalog_eval_context_idx" ON "media_catalog_evaluations" ("context");
CREATE INDEX IF NOT EXISTS "media_catalog_eval_context_status_idx" ON "media_catalog_evaluations" ("context", "status", "relevance_score" DESC);
CREATE INDEX IF NOT EXISTS "idx_media_catalog_evaluations_version_item" ON "media_catalog_evaluations" ("policy_version", "media_item_id");
CREATE INDEX IF NOT EXISTS "idx_media_catalog_evaluations_version_item_status" ON "media_catalog_evaluations" ("policy_version", "media_item_id", "status");

-- ============================================================
-- PROVIDER SYSTEM
-- ============================================================

-- Provider Registry
CREATE TABLE IF NOT EXISTS "provider_registry" (
  "id" text PRIMARY KEY,
  "display_name" text NOT NULL,
  "brand_group" text,
  "logo_path" text,
  "priority" integer DEFAULT 100,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Provider Variants
CREATE TABLE IF NOT EXISTS "provider_variants" (
  "id" text PRIMARY KEY,
  "provider_id" text NOT NULL REFERENCES "provider_registry"("id"),
  "display_label" text,
  "is_ads_tier" boolean DEFAULT false,
  "is_premium_tier" boolean DEFAULT false,
  "priority" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "provider_variants_provider_idx" ON "provider_variants" ("provider_id");

-- Provider Mappings
CREATE TABLE IF NOT EXISTS "provider_mappings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tmdb_provider_id" integer NOT NULL,
  "provider_id" text NOT NULL REFERENCES "provider_registry"("id"),
  "variant_id" text REFERENCES "provider_variants"("id"),
  "distribution_channel" "distribution_channel" DEFAULT 'direct' NOT NULL,
  "region" text DEFAULT 'global' NOT NULL,
  "notes" text,
  "source" text DEFAULT 'manual',
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "provider_mappings_tmdb_region_uniq" ON "provider_mappings" ("tmdb_provider_id", "region");
CREATE INDEX IF NOT EXISTS "provider_mappings_tmdb_idx" ON "provider_mappings" ("tmdb_provider_id");

-- Provider Unmapped
CREATE TABLE IF NOT EXISTS "provider_unmapped" (
  "tmdb_provider_id" integer PRIMARY KEY,
  "last_seen_name" text NOT NULL,
  "sample_names" text[] DEFAULT '{}',
  "first_seen_at" timestamp DEFAULT now() NOT NULL,
  "last_seen_at" timestamp DEFAULT now() NOT NULL,
  "seen_count" integer DEFAULT 1 NOT NULL,
  "sample_regions" text[] DEFAULT '{}'
);

-- Media Watch Offers
CREATE TABLE IF NOT EXISTS "media_watch_offers" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "media_item_id" uuid NOT NULL REFERENCES "media_items"("id") ON DELETE CASCADE,
  "provider_id" text NOT NULL REFERENCES "provider_registry"("id"),
  "variant_id" text REFERENCES "provider_variants"("id"),
  "distribution_channel" "distribution_channel" DEFAULT 'direct' NOT NULL,
  "offer_type" "offer_type" NOT NULL,
  "region" text NOT NULL,
  "link" text,
  "tmdb_provider_id" integer NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "media_watch_offers_media_idx" ON "media_watch_offers" ("media_item_id");
CREATE INDEX IF NOT EXISTS "media_watch_offers_provider_idx" ON "media_watch_offers" ("provider_id");
CREATE INDEX IF NOT EXISTS "media_watch_offers_offer_type_idx" ON "media_watch_offers" ("offer_type");
CREATE INDEX IF NOT EXISTS "media_watch_offers_region_idx" ON "media_watch_offers" ("region");
CREATE INDEX IF NOT EXISTS "media_watch_offers_provider_offer_idx" ON "media_watch_offers" ("provider_id", "offer_type");
CREATE INDEX IF NOT EXISTS "media_watch_offers_tmdb_idx" ON "media_watch_offers" ("tmdb_provider_id");
CREATE UNIQUE INDEX IF NOT EXISTS "media_watch_offers_uniq" ON "media_watch_offers" (
  "media_item_id", "provider_id", COALESCE("variant_id", 'standard'),
  "distribution_channel", "offer_type", "region"
);

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION aggregate_run_counters(p_run_id uuid)
RETURNS TABLE (
  processed bigint,
  eligible bigint,
  ineligible bigint,
  pending bigint,
  errors bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::bigint AS processed,
    COUNT(*) FILTER (WHERE status = 'eligible')::bigint AS eligible,
    COUNT(*) FILTER (WHERE status = 'ineligible')::bigint AS ineligible,
    COUNT(*) FILTER (WHERE status = 'pending')::bigint AS pending,
    0::bigint AS errors
  FROM media_catalog_evaluations
  WHERE run_id = p_run_id;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================
-- PUBLIC MEDIA ITEMS VIEW
-- ============================================================

CREATE OR REPLACE VIEW public_media_items AS
SELECT 
  mi.id,
  mi.type,
  mi.tmdb_id,
  mi.imdb_id,
  mi.title,
  mi.original_title,
  mi.slug,
  mi.overview,
  mi.poster_path,
  mi.backdrop_path,
  mi.videos,
  mi.credits,
  mi.watch_providers_raw,
  mi.trending_score,
  mi.trending_rank,
  mi.popularity,
  mi.rating,
  mi.vote_count,
  mi.rating_imdb,
  mi.rating_metacritic,
  mi.rating_rotten_tomatoes,
  mi.rating_trakt,
  mi.release_date,
  mi.origin_countries,
  mi.original_language,
  mi.ingestion_status,
  mi.created_at,
  mi.updated_at,
  ms.ratingo_score,
  ms.quality_score,
  ms.popularity_score,
  ms.freshness_score,
  ms.watchers_count,
  mce.relevance_score,
  mce.status AS eligibility_status
FROM media_items mi
LEFT JOIN media_stats ms ON ms.media_item_id = mi.id
JOIN catalog_policies cp ON cp.is_active = true
JOIN media_catalog_evaluations mce 
  ON mce.media_item_id = mi.id 
  AND mce.policy_version = cp.version
  AND mce.context = 'catalog'
WHERE 
  mce.status = 'eligible'
  AND mi.ingestion_status = 'ready'
  AND mi.deleted_at IS NULL;
