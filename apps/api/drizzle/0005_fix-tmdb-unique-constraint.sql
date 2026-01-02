ALTER TABLE "media_items" DROP CONSTRAINT "media_items_tmdb_id_unique";--> statement-breakpoint
DROP INDEX "media_type_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "media_type_tmdb_idx" ON "media_items" USING btree ("type","tmdb_id");