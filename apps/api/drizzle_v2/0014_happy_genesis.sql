ALTER TABLE "media_stats" ADD COLUMN "community_average_rating" double precision;--> statement-breakpoint
ALTER TABLE "media_stats" ADD COLUMN "community_rating_count" integer DEFAULT 0;