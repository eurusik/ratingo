CREATE TABLE "user_episode_progress" (
	"user_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"watched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_episode_progress_user_id_episode_id_pk" PRIMARY KEY("user_id","episode_id")
);
--> statement-breakpoint
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_episode_progress" ADD CONSTRAINT "user_episode_progress_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_episode_progress_user_idx" ON "user_episode_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_episode_progress_episode_idx" ON "user_episode_progress" USING btree ("episode_id");