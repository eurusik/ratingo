CREATE TYPE "public"."content_class" AS ENUM('mainstream', 'anime', 'documentary', 'reality', 'kids');--> statement-breakpoint
CREATE TYPE "public"."distribution_channel" AS ENUM('direct', 'amazon_channel', 'apple_tv_channel');--> statement-breakpoint
CREATE TYPE "public"."eligibility_status" AS ENUM('pending', 'eligible', 'ineligible', 'review');--> statement-breakpoint
CREATE TYPE "public"."evaluation_context" AS ENUM('catalog', 'trending', 'homepage', 'now_playing', 'new_digital', 'search');--> statement-breakpoint
CREATE TYPE "public"."evaluation_run_status" AS ENUM('running', 'prepared', 'failed', 'cancelled', 'promoted', 'pending', 'completed', 'success');--> statement-breakpoint
CREATE TYPE "public"."ingestion_status" AS ENUM('importing', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('movie', 'show');--> statement-breakpoint
CREATE TYPE "public"."offer_type" AS ENUM('flatrate', 'rent', 'buy', 'ads', 'free');--> statement-breakpoint
CREATE TYPE "public"."saved_item_list" AS ENUM('for_later', 'considering');--> statement-breakpoint
CREATE TYPE "public"."subscription_trigger" AS ENUM('release', 'new_season', 'new_episode', 'on_streaming', 'status_changed');--> statement-breakpoint
CREATE TYPE "public"."user_media_status" AS ENUM('watching', 'completed', 'planned', 'dropped');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "catalog_evaluation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_version" integer NOT NULL,
	"status" "evaluation_run_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"cursor" text,
	"counters" jsonb DEFAULT '{"processed":0,"eligible":0,"ineligible":0,"review":0,"reasonBreakdown":{}}'::jsonb,
	"target_policy_id" uuid,
	"target_policy_version" integer,
	"baseline_policy_version" integer,
	"total_ready_snapshot" integer DEFAULT 0,
	"snapshot_cutoff" timestamp,
	"processed" integer DEFAULT 0,
	"eligible" integer DEFAULT 0,
	"ineligible" integer DEFAULT 0,
	"pending" integer DEFAULT 0,
	"errors" integer DEFAULT 0,
	"error_sample" jsonb DEFAULT '[]'::jsonb,
	"promoted_at" timestamp,
	"promoted_by" text
);
--> statement-breakpoint
CREATE TABLE "catalog_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	"policy" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"activated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"season_id" uuid NOT NULL,
	"show_id" uuid NOT NULL,
	"tmdb_id" integer,
	"number" integer NOT NULL,
	"title" text,
	"overview" text,
	"air_date" timestamp,
	"runtime" integer,
	"still_path" text,
	"vote_average" double precision
);
--> statement-breakpoint
CREATE TABLE "genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	CONSTRAINT "genres_tmdb_id_unique" UNIQUE("tmdb_id"),
	CONSTRAINT "genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_catalog_evaluations" (
	"media_item_id" uuid NOT NULL,
	"status" "eligibility_status" DEFAULT 'pending' NOT NULL,
	"reasons" text[] DEFAULT '{}' NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"policy_version" integer DEFAULT 0 NOT NULL,
	"breakout_rule_id" text,
	"evaluated_at" timestamp,
	"run_id" uuid,
	"context" "evaluation_context" DEFAULT 'catalog' NOT NULL,
	CONSTRAINT "media_catalog_evaluations_media_item_id_policy_version_context_pk" PRIMARY KEY("media_item_id","policy_version","context")
);
--> statement-breakpoint
CREATE TABLE "media_genres" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"genre_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "media_type" NOT NULL,
	"tmdb_id" integer NOT NULL,
	"imdb_id" text,
	"title" text NOT NULL,
	"original_title" text,
	"slug" text NOT NULL,
	"overview" text,
	"poster_path" text,
	"backdrop_path" text,
	"videos" jsonb DEFAULT 'null'::jsonb,
	"credits" jsonb DEFAULT '{"cast":[],"crew":[]}'::jsonb,
	"watch_providers_raw" jsonb DEFAULT 'null'::jsonb,
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
	"origin_countries" jsonb DEFAULT 'null'::jsonb,
	"original_language" text,
	"ingestion_status" "ingestion_status" DEFAULT 'ready' NOT NULL,
	"content_class" "content_class" DEFAULT 'mainstream' NOT NULL,
	"search_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, '') || ' ' || coalesce(overview, ''))) STORED,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	CONSTRAINT "media_items_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_stats" (
	"media_item_id" uuid PRIMARY KEY NOT NULL,
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "media_watchers_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"snapshot_date" timestamp NOT NULL,
	"total_watchers" integer NOT NULL,
	"region" text DEFAULT 'global'
);
--> statement-breakpoint
CREATE TABLE "movies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"runtime" integer,
	"budget" bigint,
	"revenue" bigint,
	"status" text,
	"theatrical_release_date" timestamp,
	"digital_release_date" timestamp,
	"is_now_playing" boolean DEFAULT false,
	"releases" jsonb,
	CONSTRAINT "movies_media_item_id_unique" UNIQUE("media_item_id")
);
--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE "provider_unmapped" (
	"tmdb_provider_id" integer PRIMARY KEY NOT NULL,
	"last_seen_name" text NOT NULL,
	"sample_names" text[] DEFAULT '{}',
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"seen_count" integer DEFAULT 1 NOT NULL,
	"sample_regions" text[] DEFAULT '{}'
);
--> statement-breakpoint
CREATE TABLE "provider_variants" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"display_label" text,
	"is_ads_tier" boolean DEFAULT false,
	"is_premium_tier" boolean DEFAULT false,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"ip" text,
	"expires_at" timestamp NOT NULL,
	"revoked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"show_id" uuid NOT NULL,
	"tmdb_id" integer,
	"number" integer NOT NULL,
	"name" text,
	"overview" text,
	"poster_path" text,
	"air_date" timestamp,
	"episode_count" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "shows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"total_seasons" integer,
	"total_episodes" integer,
	"status" text,
	"last_air_date" timestamp,
	"next_air_date" timestamp,
	"drop_off_analysis" jsonb,
	CONSTRAINT "shows_media_item_id_unique" UNIQUE("media_item_id")
);
--> statement-breakpoint
CREATE TABLE "user_media_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"action" text NOT NULL,
	"context" text,
	"reason_key" text,
	"payload" jsonb DEFAULT 'null'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_media_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"state" "user_media_status" NOT NULL,
	"rating" integer,
	"progress" jsonb DEFAULT 'null'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_saved_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"list" "saved_item_list" NOT NULL,
	"reason_key" varchar(64),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"media_item_id" uuid NOT NULL,
	"trigger" "subscription_trigger" NOT NULL,
	"channel" text DEFAULT 'push',
	"is_active" boolean DEFAULT true NOT NULL,
	"last_notified_at" timestamp,
	"last_notified_episode_key" text,
	"last_notified_season_number" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"username" text NOT NULL,
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
	"deleted_at" timestamp,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "catalog_evaluation_runs" ADD CONSTRAINT "catalog_evaluation_runs_target_policy_id_catalog_policies_id_fk" FOREIGN KEY ("target_policy_id") REFERENCES "public"."catalog_policies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_catalog_evaluations" ADD CONSTRAINT "media_catalog_evaluations_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_catalog_evaluations" ADD CONSTRAINT "media_catalog_evaluations_run_id_catalog_evaluation_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."catalog_evaluation_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_genres" ADD CONSTRAINT "media_genres_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_genres" ADD CONSTRAINT "media_genres_genre_id_genres_id_fk" FOREIGN KEY ("genre_id") REFERENCES "public"."genres"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_stats" ADD CONSTRAINT "media_stats_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_watch_offers" ADD CONSTRAINT "media_watch_offers_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_watch_offers" ADD CONSTRAINT "media_watch_offers_provider_id_provider_registry_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_watch_offers" ADD CONSTRAINT "media_watch_offers_variant_id_provider_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."provider_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_watchers_snapshots" ADD CONSTRAINT "media_watchers_snapshots_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movies" ADD CONSTRAINT "movies_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_mappings" ADD CONSTRAINT "provider_mappings_provider_id_provider_registry_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_mappings" ADD CONSTRAINT "provider_mappings_variant_id_provider_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."provider_variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_variants" ADD CONSTRAINT "provider_variants_provider_id_provider_registry_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."provider_registry"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_show_id_shows_id_fk" FOREIGN KEY ("show_id") REFERENCES "public"."shows"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shows" ADD CONSTRAINT "shows_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_actions" ADD CONSTRAINT "user_media_actions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_actions" ADD CONSTRAINT "user_media_actions_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_state" ADD CONSTRAINT "user_media_state_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_media_state" ADD CONSTRAINT "user_media_state_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_items" ADD CONSTRAINT "user_saved_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_items" ADD CONSTRAINT "user_saved_items_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_eval_runs_policy_version_idx" ON "catalog_evaluation_runs" USING btree ("policy_version");--> statement-breakpoint
CREATE INDEX "catalog_eval_runs_status_idx" ON "catalog_evaluation_runs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "catalog_eval_runs_target_policy_idx" ON "catalog_evaluation_runs" USING btree ("target_policy_id");--> statement-breakpoint
CREATE INDEX "catalog_policies_version_idx" ON "catalog_policies" USING btree ("version");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_season_number_uniq" ON "episodes" USING btree ("season_id","number");--> statement-breakpoint
CREATE INDEX "episodes_air_date_idx" ON "episodes" USING btree ("air_date");--> statement-breakpoint
CREATE INDEX "episodes_show_idx" ON "episodes" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "episodes_show_air_date_idx" ON "episodes" USING btree ("show_id","air_date");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_status_idx" ON "media_catalog_evaluations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_status_relevance_idx" ON "media_catalog_evaluations" USING btree ("status","relevance_score");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_policy_version_idx" ON "media_catalog_evaluations" USING btree ("policy_version");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_run_id_idx" ON "media_catalog_evaluations" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_context_idx" ON "media_catalog_evaluations" USING btree ("context");--> statement-breakpoint
CREATE INDEX "media_catalog_eval_context_status_idx" ON "media_catalog_evaluations" USING btree ("context","status","relevance_score");--> statement-breakpoint
CREATE UNIQUE INDEX "media_genres_uniq" ON "media_genres" USING btree ("media_item_id","genre_id");--> statement-breakpoint
CREATE INDEX "media_genres_genre_idx" ON "media_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_type_tmdb_idx" ON "media_items" USING btree ("type","tmdb_id");--> statement-breakpoint
CREATE INDEX "media_imdb_idx" ON "media_items" USING btree ("imdb_id");--> statement-breakpoint
CREATE INDEX "media_trending_idx" ON "media_items" USING btree ("trending_score");--> statement-breakpoint
CREATE INDEX "media_trending_rank_idx" ON "media_items" USING btree ("trending_rank");--> statement-breakpoint
CREATE INDEX "media_popularity_idx" ON "media_items" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "media_release_date_idx" ON "media_items" USING btree ("release_date");--> statement-breakpoint
CREATE UNIQUE INDEX "media_slug_idx" ON "media_items" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "media_active_idx" ON "media_items" USING btree ("deleted_at") WHERE "media_items"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "media_search_idx" ON "media_items" USING btree ("search_vector");--> statement-breakpoint
CREATE INDEX "media_content_class_idx" ON "media_items" USING btree ("content_class");--> statement-breakpoint
CREATE INDEX "media_stats_ratingo_score_idx" ON "media_stats" USING btree ("ratingo_score");--> statement-breakpoint
CREATE INDEX "media_stats_watchers_idx" ON "media_stats" USING btree ("watchers_count");--> statement-breakpoint
CREATE INDEX "media_watch_offers_media_idx" ON "media_watch_offers" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "media_watch_offers_provider_idx" ON "media_watch_offers" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "media_watch_offers_offer_type_idx" ON "media_watch_offers" USING btree ("offer_type");--> statement-breakpoint
CREATE INDEX "media_watch_offers_region_idx" ON "media_watch_offers" USING btree ("region");--> statement-breakpoint
CREATE INDEX "media_watch_offers_provider_offer_idx" ON "media_watch_offers" USING btree ("provider_id","offer_type");--> statement-breakpoint
CREATE INDEX "media_watch_offers_tmdb_idx" ON "media_watch_offers" USING btree ("tmdb_provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "media_watchers_media_date_region_uniq" ON "media_watchers_snapshots" USING btree ("media_item_id","snapshot_date","region");--> statement-breakpoint
CREATE INDEX "media_watchers_date_idx" ON "media_watchers_snapshots" USING btree ("snapshot_date");--> statement-breakpoint
CREATE INDEX "movies_now_playing_idx" ON "movies" USING btree ("is_now_playing") WHERE "movies"."is_now_playing" = true;--> statement-breakpoint
CREATE INDEX "movies_theatrical_idx" ON "movies" USING btree ("theatrical_release_date");--> statement-breakpoint
CREATE INDEX "movies_digital_idx" ON "movies" USING btree ("digital_release_date");--> statement-breakpoint
CREATE INDEX "movies_media_item_idx" ON "movies" USING btree ("media_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "provider_mappings_tmdb_region_uniq" ON "provider_mappings" USING btree ("tmdb_provider_id","region");--> statement-breakpoint
CREATE INDEX "provider_mappings_tmdb_idx" ON "provider_mappings" USING btree ("tmdb_provider_id");--> statement-breakpoint
CREATE INDEX "provider_variants_provider_idx" ON "provider_variants" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_expires_idx" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seasons_show_number_uniq" ON "seasons" USING btree ("show_id","number");--> statement-breakpoint
CREATE INDEX "seasons_show_idx" ON "seasons" USING btree ("show_id");--> statement-breakpoint
CREATE INDEX "user_media_actions_user_idx" ON "user_media_actions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_media_actions_media_idx" ON "user_media_actions" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "user_media_actions_action_idx" ON "user_media_actions" USING btree ("action");--> statement-breakpoint
CREATE INDEX "user_media_actions_created_at_idx" ON "user_media_actions" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_media_state_user_media_uniq" ON "user_media_state" USING btree ("user_id","media_item_id");--> statement-breakpoint
CREATE INDEX "user_media_state_user_idx" ON "user_media_state" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_media_state_media_idx" ON "user_media_state" USING btree ("media_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_saved_items_user_media_list_uniq" ON "user_saved_items" USING btree ("user_id","media_item_id","list");--> statement-breakpoint
CREATE INDEX "user_saved_items_user_idx" ON "user_saved_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_saved_items_user_list_idx" ON "user_saved_items" USING btree ("user_id","list");--> statement-breakpoint
CREATE UNIQUE INDEX "user_subscriptions_user_media_trigger_channel_uniq" ON "user_subscriptions" USING btree ("user_id","media_item_id","trigger","channel");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_idx" ON "user_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_subscriptions_user_active_idx" ON "user_subscriptions" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "user_subscriptions_trigger_idx" ON "user_subscriptions" USING btree ("trigger");