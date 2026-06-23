CREATE TYPE "public"."person_credit_type" AS ENUM('cast', 'crew');--> statement-breakpoint
CREATE TABLE "media_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"media_item_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"credit_type" "person_credit_type" NOT NULL,
	"character" text,
	"job" text,
	"department" text,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tmdb_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"profile_path" text,
	"known_for_department" text,
	"popularity" double precision DEFAULT 0,
	"biography" text,
	"birthday" timestamp,
	"deathday" timestamp,
	"place_of_birth" text,
	"details_fetched_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "persons_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
ALTER TABLE "media_credits" ADD CONSTRAINT "media_credits_media_item_id_media_items_id_fk" FOREIGN KEY ("media_item_id") REFERENCES "public"."media_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_credits" ADD CONSTRAINT "media_credits_person_id_persons_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."persons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_credits_uniq" ON "media_credits" USING btree ("media_item_id","person_id","credit_type",coalesce("job", ''));--> statement-breakpoint
CREATE INDEX "media_credits_person_idx" ON "media_credits" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "media_credits_media_item_idx" ON "media_credits" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "persons_popularity_idx" ON "persons" USING btree ("popularity");--> statement-breakpoint
CREATE INDEX "persons_slug_idx" ON "persons" USING btree ("slug");