CREATE TYPE "public"."import_batch_status" AS ENUM('processing', 'completed');--> statement-breakpoint
CREATE TYPE "public"."import_pending_status" AS ENUM('pending', 'resolving', 'ingesting', 'linking', 'done', 'failed');--> statement-breakpoint
CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"total_items" integer NOT NULL,
	"completed_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"status" "import_batch_status" DEFAULT 'processing' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_pending_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"imdb_id" text,
	"tmdb_id" integer,
	"resolved_tmdb_id" integer,
	"media_type" text,
	"title" text,
	"rating" integer,
	"state" text NOT NULL,
	"status" "import_pending_status" DEFAULT 'pending' NOT NULL,
	"failure_reason" text,
	"media_item_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_batches" ADD CONSTRAINT "import_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_pending_items" ADD CONSTRAINT "import_pending_items_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_pending_batch_status" ON "import_pending_items" USING btree ("batch_id","status");--> statement-breakpoint
CREATE INDEX "idx_pending_resolved_tmdb" ON "import_pending_items" USING btree ("resolved_tmdb_id","media_type","status");