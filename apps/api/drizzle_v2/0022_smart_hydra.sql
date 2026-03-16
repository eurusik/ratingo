ALTER TYPE "public"."import_batch_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TYPE "public"."import_pending_status" ADD VALUE 'cancelled';--> statement-breakpoint
ALTER TABLE "user_media_state" ALTER COLUMN "progress" DROP DEFAULT;