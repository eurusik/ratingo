/**
 * Shared row type for show queries.
 * Eliminates duplication between PopularShowsQuery and TrendingShowsQuery.
 *
 * Note: Show queries use raw SQL (not Drizzle ORM builder) with LATERAL JOINs,
 * so we only define the row type here, not select fields like movies.
 */

/**
 * Raw row type from show queries (popular/trending).
 * Maps directly to SQL SELECT columns with snake_case naming.
 */
export interface ShowSelectRow {
  id: string;
  tmdb_id: number;
  title: string;
  original_title: string | null;
  slug: string;
  overview: string | null;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: Date | null;
  videos: unknown;
  ingestion_status: string;
  rating: number;
  vote_count: number;
  rating_imdb: number | null;
  vote_count_imdb: number | null;
  rating_trakt: number | null;
  vote_count_trakt: number | null;
  rating_metacritic: number | null;
  rating_rotten_tomatoes: number | null;
  popularity: number;
  ratingo_score: number | null;
  quality_score: number | null;
  popularity_score: number | null;
  watchers_count: number | null;
  total_watchers: number | null;
  last_air_date: Date | null;
  next_air_date: Date | null;
  season_number: number | null;
  episode_number: number | null;
}
