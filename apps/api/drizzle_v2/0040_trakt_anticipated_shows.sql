CREATE TABLE IF NOT EXISTS "trakt_anticipated_shows" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"list_count" integer NOT NULL,
	"rank" integer NOT NULL,
	"fetched_at" timestamp NOT NULL
);
