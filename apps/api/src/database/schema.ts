import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
  customType,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { 
  NormalizedVideo, 
  Credits,
  WatchProvidersMap 
} from '../modules/ingestion/domain/models/normalized-media.model';
import { VideoSiteEnum, VideoTypeEnum, VideoLanguageEnum } from '../common/enums/video.enum';
import { MediaType } from '../common/enums/media-type.enum';

// Define custom tsvector type since Drizzle ORM core doesn't support it natively yet
const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

// --- ENUMS ---
export const mediaTypeEnum = pgEnum('media_type', [MediaType.MOVIE, MediaType.SHOW]);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// --- SHARED TYPES ---

export interface Video {
  key: string;
  name: string;
  site: VideoSiteEnum;
  type: VideoTypeEnum;
  official: boolean;
  language: VideoLanguageEnum; // iso_639_1
  country: string;  // iso_3166_1
}

// --- CORE CATALOG ---

/**
 * MEDIA ITEMS (Base Table)
 */
export const mediaItems = pgTable(
  'media_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    type: mediaTypeEnum('type').notNull(),
    // External IDs (Canonical)
    tmdbId: integer('tmdb_id').unique().notNull(),
    imdbId: text('imdb_id'),
    
    // Basic Info
    title: text('title').notNull(),
    originalTitle: text('original_title'),
    slug: text('slug').unique().notNull(),
    overview: text('overview'),
    
    // Visuals
    posterPath: text('poster_path'),
    backdropPath: text('backdrop_path'),
    videos: jsonb('videos').$type<Video[] | null>().default(null),
    credits: jsonb('credits').$type<Credits>().default({ cast: [], crew: [] }),
    watchProviders: jsonb('watch_providers').$type<WatchProvidersMap | null>().default(null),
    
    // Metrics (Denormalized for speed)
    trendingScore: doublePrecision('trending_score').default(0),
    popularity: doublePrecision('popularity').default(0),
    
    // Primary Rating (usually TMDB vote_average)
    rating: doublePrecision('rating').default(0),
    voteCount: integer('vote_count').default(0),

    // External Ratings
    ratingImdb: doublePrecision('rating_imdb'),
    voteCountImdb: integer('vote_count_imdb'),
    ratingMetacritic: integer('rating_metacritic'), // 0-100
    ratingRottenTomatoes: integer('rating_rotten_tomatoes'), // 0-100
    ratingTrakt: doublePrecision('rating_trakt'),
    voteCountTrakt: integer('vote_count_trakt'),
    
    // Metadata
    releaseDate: timestamp('release_date'),
    
    // Full Text Search Vector (auto-generated)
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, '') || ' ' || coalesce(overview, ''))`
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // Soft delete support
  },
  (t) => ({
    typeIdx: index('media_type_idx').on(t.type),
    imdbIdx: index('media_imdb_idx').on(t.imdbId),
    trendingIdx: index('media_trending_idx').on(t.trendingScore),
    popularityIdx: index('media_popularity_idx').on(t.popularity),
    releaseDateIdx: index('media_release_date_idx').on(t.releaseDate),
    slugIdx: uniqueIndex('media_slug_idx').on(t.slug),
    // Partial index for active items (non-deleted)
    activeIdx: index('media_active_idx').on(t.deletedAt).where(sql`${t.deletedAt} IS NULL`),
    // GIN Index for fast full-text search
    searchIdx: index('media_search_idx').on(t.searchVector),
  })
);

/**
 * MEDIA STATS (Fast-changing data, updated frequently)
 */
export const mediaStats = pgTable('media_stats', {
  mediaItemId: uuid('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .primaryKey(),
  
  // Real-time stats from Trakt
  watchersCount: integer('watchers_count').default(0),  // People watching RIGHT NOW
  
  // Trending/Popularity metrics
  trendingRank: integer('trending_rank'),               // Position in trending list
  popularity24h: doublePrecision('popularity_24h'),     // Popularity score last 24h
  
  // Ratingo Score (0.0 - 1.0, calculated)
  ratingoScore: doublePrecision('ratingo_score'),       // Main composite score
  qualityScore: doublePrecision('quality_score'),       // Rating-based component
  popularityScore: doublePrecision('popularity_score'), // Popularity-based component
  freshnessScore: doublePrecision('freshness_score'),   // Time-based component
  
  // Timestamps
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  ratingoScoreIdx: index('media_stats_ratingo_score_idx').on(t.ratingoScore),
  watchersIdx: index('media_stats_watchers_idx').on(t.watchersCount),
}));

/**
 * Release info from TMDB release_dates endpoint.
 */
export interface ReleaseInfo {
  country: string;
  type: number; // TMDB type: 1=Premiere, 2=Theatrical (limited), 3=Theatrical, 4=Digital, 5=Physical, 6=TV
  date: string;
  certification?: string;
}

/**
 * MOVIES (Details)
 */
export const movies = pgTable('movies', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaItemId: uuid('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
    
  runtime: integer('runtime'),
  budget: integer('budget'),
  revenue: integer('revenue'),
  status: text('status'),
  
  // Release dates (denormalized for fast queries)
  theatricalReleaseDate: timestamp('theatrical_release_date'), // Type 3 (Theatrical)
  digitalReleaseDate: timestamp('digital_release_date'),       // Type 4 (Digital)
  
  // Now Playing flag (synced from TMDB /movie/now_playing)
  isNowPlaying: boolean('is_now_playing').default(false),
  
  // Full release data from TMDB (for analytics/future use)
  releases: jsonb('releases').$type<ReleaseInfo[]>(),
}, (t) => ({
  // Partial index for NOW PLAYING queries - only indexes rows where true
  nowPlayingIdx: index('movies_now_playing_idx').on(t.isNowPlaying).where(sql`${t.isNowPlaying} = true`),
  // Index for NEW RELEASES queries - DESC for recent first
  theatricalIdx: index('movies_theatrical_idx').on(t.theatricalReleaseDate),
  // Index for NEW ON DIGITAL queries
  digitalIdx: index('movies_digital_idx').on(t.digitalReleaseDate),
  // FK index for fast JOINs
  mediaItemIdx: index('movies_media_item_idx').on(t.mediaItemId),
}));

/**
 * SHOWS (Details)
 */
export const shows = pgTable('shows', {
  id: uuid('id').defaultRandom().primaryKey(),
  mediaItemId: uuid('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
    
  totalSeasons: integer('total_seasons'),
  totalEpisodes: integer('total_episodes'),
  status: text('status'),
  lastAirDate: timestamp('last_air_date'),
  nextAirDate: timestamp('next_air_date'),
  
  // Pre-calculated drop-off analysis (updated by background job)
  dropOffAnalysis: jsonb('drop_off_analysis').$type<{
    dropOffPoint: { season: number; episode: number; title: string } | null;
    dropOffPercent: number;
    overallRetention: number;
    seasonEngagement: Array<{
      season: number;
      avgRating: number;
      avgVotes: number;
      engagementDrop: number;
    }>;
    insight: string;
    insightType: 'strong_start' | 'steady' | 'drops_early' | 'drops_late';
    analyzedAt: string;
    episodesAnalyzed: number;
  }>(),
});

// --- SEASONS & EPISODES (Normalized) ---

export const seasons = pgTable('seasons', {
  id: uuid('id').defaultRandom().primaryKey(),
  showId: uuid('show_id').references(() => shows.id, { onDelete: 'cascade' }).notNull(),
  tmdbId: integer('tmdb_id'),
  number: integer('number').notNull(),
  name: text('name'),
  overview: text('overview'),
  posterPath: text('poster_path'),
  airDate: timestamp('air_date'),
  episodeCount: integer('episode_count').default(0),
}, (t) => ({
  showSeasonIdx: uniqueIndex('seasons_show_number_uniq').on(t.showId, t.number),
  showIdx: index('seasons_show_idx').on(t.showId),
}));

export const episodes = pgTable('episodes', {
  id: uuid('id').defaultRandom().primaryKey(),
  seasonId: uuid('season_id').references(() => seasons.id, { onDelete: 'cascade' }).notNull(),
  showId: uuid('show_id').references(() => shows.id, { onDelete: 'cascade' }).notNull(), // Denormalized for fast calendar queries
  
  tmdbId: integer('tmdb_id'),
  number: integer('number').notNull(),
  title: text('title'),
  overview: text('overview'),
  airDate: timestamp('air_date'),
  runtime: integer('runtime'),
  stillPath: text('still_path'),
  voteAverage: doublePrecision('vote_average'),
}, (t) => ({
  seasonEpisodeIdx: uniqueIndex('episodes_season_number_uniq').on(t.seasonId, t.number),
  airDateIdx: index('episodes_air_date_idx').on(t.airDate),
  showIdx: index('episodes_show_idx').on(t.showId),
  showAirDateIdx: index('episodes_show_air_date_idx').on(t.showId, t.airDate),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  show: one(shows, {
    fields: [seasons.showId],
    references: [shows.id],
  }),
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one }) => ({
  season: one(seasons, {
    fields: [episodes.seasonId],
    references: [seasons.id],
  }),
  show: one(shows, {
    fields: [episodes.showId],
    references: [shows.id],
  }),
}));


// --- GENRES ---

export const genres = pgTable('genres', {
  id: uuid('id').defaultRandom().primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
});

export const mediaGenres = pgTable(
  'media_genres',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    genreId: uuid('genre_id')
      .references(() => genres.id, { onDelete: 'cascade' })
      .notNull(),
  },
  (t) => ({
    uniq: uniqueIndex('media_genres_uniq').on(t.mediaItemId, t.genreId),
    genreIdx: index('media_genres_genre_idx').on(t.genreId),
  })
);

// --- USERS & SOCIAL ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});


// --- RELATIONS ---

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  movieDetails: one(movies, {
    fields: [mediaItems.id],
    references: [movies.mediaItemId],
  }),
  showDetails: one(shows, {
    fields: [mediaItems.id],
    references: [shows.mediaItemId],
  }),
  genres: many(mediaGenres),
}));

export const moviesRelations = relations(movies, ({ one }) => ({
  base: one(mediaItems, {
    fields: [movies.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const showsRelations = relations(shows, ({ one }) => ({
  base: one(mediaItems, {
    fields: [shows.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const mediaGenresRelations = relations(mediaGenres, ({ one }) => ({
  media: one(mediaItems, {
    fields: [mediaGenres.mediaItemId],
    references: [mediaItems.id],
  }),
  genre: one(genres, {
    fields: [mediaGenres.genreId],
    references: [genres.id],
  }),
}));
