ALTER TABLE "media_items" DROP CONSTRAINT IF EXISTS "media_items_slug_unique";--> statement-breakpoint
ALTER TABLE "media_items" DROP CONSTRAINT IF EXISTS "media_items_slug_key";--> statement-breakpoint
DROP INDEX IF EXISTS "media_slug_idx";--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "media_type_slug_idx" ON "media_items" USING btree ("type","slug");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "media_slug_idx" ON "media_items" USING btree ("slug");