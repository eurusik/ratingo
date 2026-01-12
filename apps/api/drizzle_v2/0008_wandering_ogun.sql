CREATE TYPE "public"."post_type" AS ENUM('update', 'explanation', 'fix', 'roadmap');--> statement-breakpoint
CREATE TABLE "journal_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"body_html" text NOT NULL,
	"excerpt" text NOT NULL,
	"type" "post_type" NOT NULL,
	"featured_image_url" text,
	"context_id" text,
	"meta_title" text,
	"meta_description" text,
	"is_draft" boolean DEFAULT true NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"author_id" uuid NOT NULL,
	CONSTRAINT "journal_posts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "journal_posts" ADD CONSTRAINT "journal_posts_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_journal_posts_type" ON "journal_posts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_journal_posts_context" ON "journal_posts" USING btree ("context_id") WHERE "journal_posts"."context_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_journal_posts_published" ON "journal_posts" USING btree ("published_at","created_at") WHERE "journal_posts"."is_draft" = false;