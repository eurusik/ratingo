CREATE TABLE "ai"."chat_exchanges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"route" text NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"outcome" text NOT NULL,
	"cut_numbers" jsonb NOT NULL,
	"tool_names" jsonb NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai"."chat_exchanges" ADD CONSTRAINT "chat_exchanges_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "ai"."runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_exchanges_chat_created_idx" ON "ai"."chat_exchanges" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_exchanges_created_idx" ON "ai"."chat_exchanges" USING btree ("created_at");