ALTER TABLE "media_items" DROP CONSTRAINT "media_items_slug_key";--> statement-breakpoint
DROP INDEX "media_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "media_type_slug_idx" ON "media_items" USING btree ("type","slug");--> statement-breakpoint
CREATE INDEX "media_slug_idx" ON "media_items" USING btree ("slug");