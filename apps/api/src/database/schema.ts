import {
  pgTable,
  text,
  varchar,
  integer,
  bigint,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
  customType,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import {
  NormalizedVideo,
  Credits,
  WatchProvidersMap,
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
export const userMediaStatusEnum = pgEnum('user_media_status', [
  'watching',
  'completed',
  'planned',
  'dropped',
]);
export const ingestionStatusEnum = pgEnum('ingestion_status', ['importing', 'ready', 'failed']);
export const eligibilityStatusEnum = pgEnum('eligibility_status', [
  'pending',
  'eligible',
  'ineligible',
  'review',
]);
export const evaluationRunStatusEnum = pgEnum('evaluation_run_status', [
  'running',
  'prepared',
  'failed',
  'cancelled',
  'promoted',
  // Legacy values - kept for backward compatibility during migration
  'pending', // @deprecated - use 'running'
  'completed', // @deprecated - use 'prepared'
  'success', // @deprecated - use 'prepared'
]);

// --- SHARED TYPES ---

export interface Video {
  key: string;
  name: string;
  site: VideoSiteEnum;
  type: VideoTypeEnum;
  official: boolean;
  language: VideoLanguageEnum; // iso_639_1
  country: string; // iso_3166_1
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
    tmdbId: integer('tmdb_id').notNull(), // Unique per type, not globally
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
    trendingRank: integer('trending_rank'), // Position in TMDB trending list (1 = top)
    trendingUpdatedAt: timestamp('trending_updated_at'), // When last updated by trending sync
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
    originCountries: jsonb('origin_countries').$type<string[] | null>().default(null),
    originalLanguage: text('original_language'),
    ingestionStatus: ingestionStatusEnum('ingestion_status').default('ready').notNull(),

    // Full Text Search Vector (auto-generated)
    searchVector: tsvector('search_vector').generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(original_title, '') || ' ' || coalesce(overview, ''))`,
    ),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
    deletedAt: timestamp('deleted_at'), // Soft delete support
  },
  (t) => ({
    // Composite unique: same tmdb_id can exist for movie AND show
    typeTmdbIdx: uniqueIndex('media_type_tmdb_idx').on(t.type, t.tmdbId),
    imdbIdx: index('media_imdb_idx').on(t.imdbId),
    trendingIdx: index('media_trending_idx').on(t.trendingScore),
    trendingRankIdx: index('media_trending_rank_idx').on(t.trendingRank),
    popularityIdx: index('media_popularity_idx').on(t.popularity),
    releaseDateIdx: index('media_release_date_idx').on(t.releaseDate),
    slugIdx: uniqueIndex('media_slug_idx').on(t.slug),
    // Partial index for active items (non-deleted)
    activeIdx: index('media_active_idx')
      .on(t.deletedAt)
      .where(sql`${t.deletedAt} IS NULL`),
    // GIN Index for fast full-text search
    searchIdx: index('media_search_idx').on(t.searchVector),
  }),
);

/**
 * MEDIA STATS (Fast-changing data, updated frequently)
 */
export const mediaStats = pgTable(
  'media_stats',
  {
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .primaryKey(),

    // Real-time stats from Trakt
    watchersCount: integer('watchers_count').default(0), // People watching RIGHT NOW (Live)
    totalWatchers: integer('total_watchers').default(0), // Total unique watchers (All time)

    // Trending/Popularity metrics
    trendingRank: integer('trending_rank'), // Position in trending list
    popularity24h: doublePrecision('popularity_24h'), // Popularity score last 24h

    // Ratingo Score (0.0 - 1.0, calculated)
    ratingoScore: doublePrecision('ratingo_score'), // Main composite score
    qualityScore: doublePrecision('quality_score'), // Rating-based component
    popularityScore: doublePrecision('popularity_score'), // Popularity-based component
    freshnessScore: doublePrecision('freshness_score'), // Time-based component

    // Timestamps
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    ratingoScoreIdx: index('media_stats_ratingo_score_idx').on(t.ratingoScore),
    watchersIdx: index('media_stats_watchers_idx').on(t.watchersCount),
  }),
);

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
export const movies = pgTable(
  'movies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull()
      .unique(),

    runtime: integer('runtime'),
    budget: bigint('budget', { mode: 'number' }),
    revenue: bigint('revenue', { mode: 'number' }),
    status: text('status'),

    // Release dates (denormalized for fast queries)
    theatricalReleaseDate: timestamp('theatrical_release_date'), // Type 3 (Theatrical)
    digitalReleaseDate: timestamp('digital_release_date'), // Type 4 (Digital)

    // Now Playing flag (synced from TMDB /movie/now_playing)
    isNowPlaying: boolean('is_now_playing').default(false),

    // Full release data from TMDB (for analytics/future use)
    releases: jsonb('releases').$type<ReleaseInfo[]>(),
  },
  (t) => ({
    // Partial index for NOW PLAYING queries - only indexes rows where true
    nowPlayingIdx: index('movies_now_playing_idx')
      .on(t.isNowPlaying)
      .where(sql`${t.isNowPlaying} = true`),
    // Index for NEW RELEASES queries - DESC for recent first
    theatricalIdx: index('movies_theatrical_idx').on(t.theatricalReleaseDate),
    // Index for NEW ON DIGITAL queries
    digitalIdx: index('movies_digital_idx').on(t.digitalReleaseDate),
    // FK index for fast JOINs
    mediaItemIdx: index('movies_media_item_idx').on(t.mediaItemId),
  }),
);

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

export const seasons = pgTable(
  'seasons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    showId: uuid('show_id')
      .references(() => shows.id, { onDelete: 'cascade' })
      .notNull(),
    tmdbId: integer('tmdb_id'),
    number: integer('number').notNull(),
    name: text('name'),
    overview: text('overview'),
    posterPath: text('poster_path'),
    airDate: timestamp('air_date'),
    episodeCount: integer('episode_count').default(0),
  },
  (t) => ({
    showSeasonIdx: uniqueIndex('seasons_show_number_uniq').on(t.showId, t.number),
    showIdx: index('seasons_show_idx').on(t.showId),
  }),
);

export const episodes = pgTable(
  'episodes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    seasonId: uuid('season_id')
      .references(() => seasons.id, { onDelete: 'cascade' })
      .notNull(),
    showId: uuid('show_id')
      .references(() => shows.id, { onDelete: 'cascade' })
      .notNull(), // Denormalized for fast calendar queries

    tmdbId: integer('tmdb_id'),
    number: integer('number').notNull(),
    title: text('title'),
    overview: text('overview'),
    airDate: timestamp('air_date'),
    runtime: integer('runtime'),
    stillPath: text('still_path'),
    voteAverage: doublePrecision('vote_average'),
  },
  (t) => ({
    seasonEpisodeIdx: uniqueIndex('episodes_season_number_uniq').on(t.seasonId, t.number),
    airDateIdx: index('episodes_air_date_idx').on(t.airDate),
    showIdx: index('episodes_show_idx').on(t.showId),
    showAirDateIdx: index('episodes_show_air_date_idx').on(t.showId, t.airDate),
  }),
);

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
  }),
);

// --- USERS & SOCIAL ---

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  location: text('location'),
  website: text('website'),
  preferredLanguage: text('preferred_language'),
  preferredRegion: text('preferred_region'),
  isProfilePublic: boolean('is_profile_public').default(true),
  showWatchHistory: boolean('show_watch_history').default(true),
  showRatings: boolean('show_ratings').default(true),
  allowFollowers: boolean('allow_followers').default(true),
  role: userRoleEnum('role').default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});

export const userMediaState = pgTable(
  'user_media_state',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    state: userMediaStatusEnum('state').notNull(),
    rating: integer('rating'), // 0-100 scale
    progress: jsonb('progress').$type<Record<string, unknown> | null>().default(null),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqUserMedia: uniqueIndex('user_media_state_user_media_uniq').on(t.userId, t.mediaItemId),
    userIdx: index('user_media_state_user_idx').on(t.userId),
    mediaIdx: index('user_media_state_media_idx').on(t.mediaItemId),
  }),
);

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(), // jti
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: timestamp('expires_at').notNull(),
    revokedAt: timestamp('revoked_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('refresh_tokens_user_idx').on(t.userId),
    expiresIdx: index('refresh_tokens_expires_idx').on(t.expiresAt),
  }),
);

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

/**
 * DAILY WATCHERS SNAPSHOTS (Time-series for Rise/Fall analysis)
 */
export const mediaWatchersSnapshots = pgTable(
  'media_watchers_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    snapshotDate: timestamp('snapshot_date').notNull(),
    totalWatchers: integer('total_watchers').notNull(), // Trakt /stats.watchers (cumulative)
    region: text('region').default('global'),
  },
  (t) => ({
    mediaDateIdx: uniqueIndex('media_watchers_media_date_region_uniq').on(
      t.mediaItemId,
      t.snapshotDate,
      t.region,
    ),
    dateIdx: index('media_watchers_date_idx').on(t.snapshotDate),
  }),
);

export const mediaWatchersSnapshotsRelations = relations(mediaWatchersSnapshots, ({ one }) => ({
  media: one(mediaItems, {
    fields: [mediaWatchersSnapshots.mediaItemId],
    references: [mediaItems.id],
  }),
}));

// --- USER ACTIONS & SAVED ITEMS (Event Layer) ---

/**
 * Saved item list types.
 */
export const savedItemListEnum = pgEnum('saved_item_list', ['for_later', 'considering']);

/**
 * Subscription trigger types.
 * - release: Movie release notification
 * - new_season: New season of a show
 * - new_episode: New episode aired
 * - on_streaming: Available on streaming platform
 * - status_changed: Show status changed (e.g., renewed, canceled)
 */
export const subscriptionTriggerEnum = pgEnum('subscription_trigger', [
  'release',
  'new_season',
  'new_episode',
  'on_streaming',
  'status_changed',
]);

/**
 * USER MEDIA ACTIONS (Event Log)
 * Tracks all user interactions with media for analytics and history.
 */
export const userMediaActions = pgTable(
  'user_media_actions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),

    // Action type: save_for_later, consider, subscribe, unsubscribe, start_watching, mark_completed, etc.
    action: text('action').notNull(),

    // Where the action originated: verdict, card, details, hero, section:trending, etc.
    context: text('context'),

    // Verdict/reason that triggered the action: trendingNow, newSeason, criticsLoved, mixedReviews, etc.
    reasonKey: text('reason_key'),

    // Flexible payload for additional details without migrations
    payload: jsonb('payload').$type<Record<string, unknown> | null>().default(null),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_media_actions_user_idx').on(t.userId),
    mediaIdx: index('user_media_actions_media_idx').on(t.mediaItemId),
    actionIdx: index('user_media_actions_action_idx').on(t.action),
    createdAtIdx: index('user_media_actions_created_at_idx').on(t.createdAt),
  }),
);

/**
 * USER SAVED ITEMS (Projection)
 * Current state of saved items per user.
 */
export const userSavedItems = pgTable(
  'user_saved_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),

    // List type: for_later (trending/new) or considering (mixed/decent ratings)
    list: savedItemListEnum('list').notNull(),

    // Reason why item was saved (verdict key)
    reasonKey: varchar('reason_key', { length: 64 }),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqUserMediaList: uniqueIndex('user_saved_items_user_media_list_uniq').on(
      t.userId,
      t.mediaItemId,
      t.list,
    ),
    userIdx: index('user_saved_items_user_idx').on(t.userId),
    userListIdx: index('user_saved_items_user_list_idx').on(t.userId, t.list),
  }),
);

/**
 * USER SUBSCRIPTIONS (Notifications)
 * Tracks user subscriptions for release/season notifications.
 */
export const userSubscriptions = pgTable(
  'user_subscriptions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),

    // What triggers the notification: release, new_season, on_streaming
    trigger: subscriptionTriggerEnum('trigger').notNull(),

    // Notification channel (for future: email, push, telegram)
    channel: text('channel').default('push'),

    isActive: boolean('is_active').default(true).notNull(),
    lastNotifiedAt: timestamp('last_notified_at'),

    // Dedup markers to prevent duplicate notifications
    lastNotifiedEpisodeKey: text('last_notified_episode_key'), // e.g., 'S2E5'
    lastNotifiedSeasonNumber: integer('last_notified_season_number'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    uniqUserMediaTriggerChannel: uniqueIndex(
      'user_subscriptions_user_media_trigger_channel_uniq',
    ).on(t.userId, t.mediaItemId, t.trigger, t.channel),
    userIdx: index('user_subscriptions_user_idx').on(t.userId),
    userActiveIdx: index('user_subscriptions_user_active_idx').on(t.userId, t.isActive),
    triggerIdx: index('user_subscriptions_trigger_idx').on(t.trigger),
  }),
);

// --- RELATIONS FOR NEW TABLES ---

export const userMediaActionsRelations = relations(userMediaActions, ({ one }) => ({
  user: one(users, {
    fields: [userMediaActions.userId],
    references: [users.id],
  }),
  media: one(mediaItems, {
    fields: [userMediaActions.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const userSavedItemsRelations = relations(userSavedItems, ({ one }) => ({
  user: one(users, {
    fields: [userSavedItems.userId],
    references: [users.id],
  }),
  media: one(mediaItems, {
    fields: [userSavedItems.mediaItemId],
    references: [mediaItems.id],
  }),
}));

export const userSubscriptionsRelations = relations(userSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [userSubscriptions.userId],
    references: [users.id],
  }),
  media: one(mediaItems, {
    fields: [userSubscriptions.mediaItemId],
    references: [mediaItems.id],
  }),
}));

// --- CATALOG POLICY ENGINE ---

/**
 * PolicyConfig type for catalog_policies.policy jsonb field
 */
export interface PolicyConfig {
  allowedCountries: string[];
  blockedCountries: string[];
  blockedCountryMode: 'ANY' | 'MAJORITY';
  allowedLanguages: string[];
  blockedLanguages: string[];
  globalProviders: string[];
  breakoutRules: BreakoutRule[];
  eligibilityMode: 'STRICT' | 'RELAXED';
  homepage: {
    minRelevanceScore: number;
  };
}

export interface BreakoutRule {
  id: string;
  name: string;
  priority: number;
  requirements: {
    minImdbVotes?: number;
    minTraktVotes?: number;
    minQualityScoreNormalized?: number;
    requireAnyOfProviders?: string[];
    requireAnyOfRatingsPresent?: ('imdb' | 'metacritic' | 'rt' | 'trakt')[];
  };
}

/**
 * CATALOG POLICIES (Versioned)
 * Stores versioned catalog filtering policies
 */
export const catalogPolicies = pgTable(
  'catalog_policies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    version: integer('version').notNull(),
    isActive: boolean('is_active').default(false).notNull(),
    policy: jsonb('policy').$type<PolicyConfig>().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    activatedAt: timestamp('activated_at'),
  },
  (t) => ({
    // Partial unique index on constant (1) where active - ensures only one active
    // SQL: CREATE UNIQUE INDEX catalog_policies_single_active ON catalog_policies ((1)) WHERE is_active = true;
    // Note: This index is created via raw SQL migration, not Drizzle
    versionIdx: index('catalog_policies_version_idx').on(t.version),
  }),
);

/**
 * MEDIA CATALOG EVALUATIONS
 * Stores evaluation results for each media item based on catalog policy.
 *
 * Key invariant: (media_item_id, policy_version) = unique evaluation
 * This enables storing evaluation history per policy version.
 */
export const mediaCatalogEvaluations = pgTable(
  'media_catalog_evaluations',
  {
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    status: eligibilityStatusEnum('status').default('pending').notNull(),
    reasons: text('reasons').array().default([]).notNull(),
    relevanceScore: integer('relevance_score').default(0).notNull(),
    policyVersion: integer('policy_version').default(0).notNull(), // 0 = no policy / pending seed
    breakoutRuleId: text('breakout_rule_id'),
    evaluatedAt: timestamp('evaluated_at'), // NULL for pending, set when actually evaluated
  },
  (t) => ({
    // Composite primary key: (media_item_id, policy_version)
    pk: primaryKey({ columns: [t.mediaItemId, t.policyVersion] }),
    statusIdx: index('media_catalog_eval_status_idx').on(t.status),
    statusRelevanceIdx: index('media_catalog_eval_status_relevance_idx').on(
      t.status,
      t.relevanceScore,
    ),
    policyVersionIdx: index('media_catalog_eval_policy_version_idx').on(t.policyVersion),
    // Additional indexes added via migration 0014:
    // - media_catalog_eval_policy_status_relevance_idx (policy_version, status, relevance_score DESC)
    // - media_catalog_eval_item_version_idx (media_item_id, policy_version DESC)
  }),
);

/**
 * CATALOG EVALUATION RUNS
 * Tracks RE_EVALUATE_CATALOG job runs for monitoring and resumability
 * Extended for Policy Activation Flow (Prepare → Promote)
 */
export const catalogEvaluationRuns = pgTable(
  'catalog_evaluation_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    policyVersion: integer('policy_version').notNull(),
    status: evaluationRunStatusEnum('status').default('pending').notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    finishedAt: timestamp('finished_at'),
    cursor: text('cursor'),
    counters: jsonb('counters')
      .$type<{
        processed: number;
        eligible: number;
        ineligible: number;
        review: number;
        reasonBreakdown: Record<string, number>;
      }>()
      .default({
        processed: 0,
        eligible: 0,
        ineligible: 0,
        review: 0,
        reasonBreakdown: {},
      }),
    // Policy Activation Flow fields
    targetPolicyId: uuid('target_policy_id').references(() => catalogPolicies.id),
    targetPolicyVersion: integer('target_policy_version'),
    totalReadySnapshot: integer('total_ready_snapshot').default(0),
    snapshotCutoff: timestamp('snapshot_cutoff'),
    processed: integer('processed').default(0),
    eligible: integer('eligible').default(0),
    ineligible: integer('ineligible').default(0),
    pending: integer('pending').default(0),
    errors: integer('errors').default(0),
    errorSample: jsonb('error_sample')
      .$type<
        Array<{
          mediaItemId: string;
          error: string;
          stack?: string;
          timestamp: string;
        }>
      >()
      .default([]),
    promotedAt: timestamp('promoted_at'),
    promotedBy: text('promoted_by'),
  },
  (t) => ({
    policyVersionIdx: index('catalog_eval_runs_policy_version_idx').on(t.policyVersion),
    statusIdx: index('catalog_eval_runs_status_idx').on(t.status),
    targetPolicyIdx: index('catalog_eval_runs_target_policy_idx').on(t.targetPolicyId),
    // Note: Partial unique index for running runs created via raw SQL migration
  }),
);
