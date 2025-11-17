/**
 * Схема БД (Postgres, Drizzle): основні сутності для шоу, ефірів,
 * рейтингів, провайдерів, перекладів і черги синку.
 */
import {
  pgTable,
  serial,
  integer,
  text,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
  jsonb,
  boolean,
} from 'drizzle-orm/pg-core';

/**
 * Таблиця шоу: об’єднує TMDB/Trakt/OMDb метадані та обчислені метрики.
 */
export const shows = pgTable(
  'shows',
  {
    id: serial('id').primaryKey(),
    tmdbId: integer('tmdb_id').notNull().unique(),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    titleUk: text('title_uk'),
    overview: text('overview'),
    overviewUk: text('overview_uk'),
    poster: text('poster'),
    posterUk: text('poster_uk'),
    backdrop: text('backdrop'),
    genres: jsonb('genres'),
    videos: jsonb('videos'),
    ratingTmdb: doublePrecision('rating_tmdb'),
    ratingTmdbCount: integer('rating_tmdb_count'),
    popularityTmdb: doublePrecision('popularity_tmdb'),
    ratingImdb: doublePrecision('rating_imdb'),
    imdbVotes: integer('imdb_votes'),
    contentRating: text('content_rating'),
    watchProviders: jsonb('watch_providers'),
    cast: jsonb('cast'),
    related: jsonb('related'),
    ratingMetacritic: doublePrecision('rating_metacritic'),
    ratingTraktAvg: doublePrecision('rating_trakt_avg'),
    ratingTraktVotes: integer('rating_trakt_votes'),
    ratingTrakt: doublePrecision('rating_trakt'),
    watchersDelta: doublePrecision('watchers_delta'),
    delta3m: doublePrecision('delta_3m'),
    primaryRating: doublePrecision('primary_rating'),
    trendingScore: doublePrecision('trending_score'),
    firstAirDate: text('first_air_date'),
    numberOfSeasons: integer('number_of_seasons'),
    numberOfEpisodes: integer('number_of_episodes'),
    latestSeasonNumber: integer('latest_season_number'),
    latestSeasonEpisodes: integer('latest_season_episodes'),
    lastEpisodeSeason: integer('last_episode_season'),
    lastEpisodeNumber: integer('last_episode_number'),
    lastEpisodeAirDate: text('last_episode_air_date'),
    nextEpisodeSeason: integer('next_episode_season'),
    nextEpisodeNumber: integer('next_episode_number'),
    nextEpisodeAirDate: text('next_episode_air_date'),
    status: text('status'),
    tagline: text('tagline'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    trendingUpdatedAt: timestamp('trending_updated_at'),
  },
  (table) => {
    return {
      tmdbIdIdx: uniqueIndex('tmdb_id_idx').on(table.tmdbId),
      trendingScoreIdx: index('trending_score_idx').on(table.trendingScore),
      ratingTraktIdx: index('shows_rating_trakt_idx').on(table.ratingTrakt),
      trendingUpdatedAtIdx: index('shows_trending_updated_at_idx').on(table.trendingUpdatedAt),
      watchersDeltaIdx: index('shows_watchers_delta_idx').on(table.watchersDelta),
      delta3mIdx: index('shows_delta_3m_idx').on(table.delta3m),
    };
  }
);

/**
 * Таблиця фільмів: TMDB/Trakt/OMDb метадані, провайдери, каст та трендові метрики.
 */
export const movies = pgTable(
  'movies',
  {
    id: serial('id').primaryKey(),
    tmdbId: integer('tmdb_id').notNull().unique(),
    imdbId: text('imdb_id'),
    title: text('title').notNull(),
    titleUk: text('title_uk'),
    overview: text('overview'),
    overviewUk: text('overview_uk'),
    poster: text('poster'),
    posterUk: text('poster_uk'),
    backdrop: text('backdrop'),
    genres: jsonb('genres'),
    videos: jsonb('videos'),
    ratingTmdb: doublePrecision('rating_tmdb'),
    ratingTmdbCount: integer('rating_tmdb_count'),
    popularityTmdb: doublePrecision('popularity_tmdb'),
    ratingImdb: doublePrecision('rating_imdb'),
    imdbVotes: integer('imdb_votes'),
    contentRating: text('content_rating'),
    watchProviders: jsonb('watch_providers'),
    cast: jsonb('cast'),
    related: jsonb('related'),
    ratingMetacritic: doublePrecision('rating_metacritic'),
    ratingTraktAvg: doublePrecision('rating_trakt_avg'),
    ratingTraktVotes: integer('rating_trakt_votes'),
    ratingTrakt: doublePrecision('rating_trakt'),
    watchersDelta: doublePrecision('watchers_delta'),
    delta3m: doublePrecision('delta_3m'),
    primaryRating: doublePrecision('primary_rating'),
    trendingScore: doublePrecision('trending_score'),
    releaseDate: text('release_date'),
    runtime: integer('runtime'),
    status: text('status'),
    tagline: text('tagline'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    trendingUpdatedAt: timestamp('trending_updated_at'),
  },
  (table) => {
    return {
      tmdbIdIdx: uniqueIndex('movies_tmdb_id_idx').on(table.tmdbId),
      trendingScoreIdx: index('movies_trending_score_idx').on(table.trendingScore),
      ratingTraktIdx: index('movies_rating_trakt_idx').on(table.ratingTrakt),
      trendingUpdatedAtIdx: index('movies_trending_updated_at_idx').on(table.trendingUpdatedAt),
      watchersDeltaIdx: index('movies_watchers_delta_idx').on(table.watchersDelta),
      delta3mIdx: index('movies_delta_3m_idx').on(table.delta3m),
    };
  }
);

/**
 * Ефіри епізодів: календарні записи для серій.
 */
export const showAirings = pgTable(
  'show_airings',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id'),
    tmdbId: integer('tmdb_id').notNull(),
    traktId: integer('trakt_id'),
    title: text('title'),
    episodeTitle: text('episode_title'),
    season: integer('season'),
    episode: integer('episode'),
    airDate: text('air_date'),
    type: text('type'), // 'episode' | 'premiere'
    network: text('network'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      tmdbSeasonEpisodeIdx: uniqueIndex('airings_tmdb_season_ep_idx').on(
        table.tmdbId,
        table.season,
        table.episode
      ),
      airDateIdx: index('airings_air_date_idx').on(table.airDate),
      showIdIdx: index('airings_show_id_idx').on(table.showId),
    };
  }
);

/**
 * Зв’язки між шоу (related) з джерелом та ранжуванням.
 */
export const showRelated = pgTable(
  'show_related',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    relatedShowId: integer('related_show_id').notNull(),
    source: text('source'), // 'trakt' | 'tmdb'
    rank: integer('rank'),
    score: doublePrecision('score'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_related_unique_idx').on(table.showId, table.relatedShowId),
      showIdIdx: index('show_related_show_id_idx').on(table.showId),
    };
  }
);

/**
 * Зв’язки між фільмами (related) з джерелом та ранжуванням.
 */
export const movieRelated = pgTable(
  'movie_related',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    relatedMovieId: integer('related_movie_id').notNull(),
    source: text('source'),
    rank: integer('rank'),
    score: doublePrecision('score'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_related_unique_idx').on(table.movieId, table.relatedMovieId),
      movieIdIdx: index('movie_related_movie_id_idx').on(table.movieId),
    };
  }
);

/**
 * Рейтинги шоу (Trakt): середній та кількість голосів.
 */
export const showRatings = pgTable(
  'show_ratings',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    source: text('source').notNull(), // 'trakt'
    avg: doublePrecision('avg'),
    votes: integer('votes'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_ratings_unique_idx').on(table.showId, table.source),
      showIdIdx: index('show_ratings_show_id_idx').on(table.showId),
    };
  }
);

/**
 * Рейтинги фільмів (наприклад Trakt): середній та кількість голосів.
 */
export const movieRatings = pgTable(
  'movie_ratings',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    source: text('source').notNull(),
    avg: doublePrecision('avg'),
    votes: integer('votes'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_ratings_unique_idx').on(table.movieId, table.source),
      movieIdIdx: index('movie_ratings_movie_id_idx').on(table.movieId),
    };
  }
);

/**
 * Дистрибуція рейтингів (1..10) для шоу.
 */
export const showRatingBuckets = pgTable(
  'show_rating_buckets',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    source: text('source').notNull(), // 'trakt'
    bucket: integer('bucket').notNull(), // 1..10
    count: integer('count').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_rating_buckets_uniq_idx').on(
        table.showId,
        table.source,
        table.bucket
      ),
      showIdIdx: index('show_rating_buckets_show_id_idx').on(table.showId),
    };
  }
);

/**
 * Дистрибуція рейтингів (1..10) для фільмів.
 */
export const movieRatingBuckets = pgTable(
  'movie_rating_buckets',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    source: text('source').notNull(),
    bucket: integer('bucket').notNull(),
    count: integer('count').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_rating_buckets_uniq_idx').on(
        table.movieId,
        table.source,
        table.bucket
      ),
      movieIdIdx: index('movie_rating_buckets_movie_id_idx').on(table.movieId),
    };
  }
);

/**
 * Снапшоти числа глядачів з часом для TMDB ID.
 */
export const showWatchersSnapshots = pgTable(
  'show_watchers_snapshots',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    watchers: integer('watchers').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      showIdIdx: index('show_watchers_snapshots_show_id_idx').on(table.showId),
      tmdbIdIdx: index('show_watchers_snapshots_tmdb_id_idx').on(table.tmdbId),
      createdIdx: index('show_watchers_snapshots_created_idx').on(table.createdAt),
    };
  }
);

/**
 * Снапшоти числа глядачів з часом для TMDB ID фільму.
 */
export const movieWatchersSnapshots = pgTable(
  'movie_watchers_snapshots',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    watchers: integer('watchers').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      movieIdIdx: index('movie_watchers_snapshots_movie_id_idx').on(table.movieId),
      tmdbIdIdx: index('movie_watchers_snapshots_tmdb_id_idx').on(table.tmdbId),
      createdIdx: index('movie_watchers_snapshots_created_idx').on(table.createdAt),
    };
  }
);

// New normalized tables
// Store localized texts per locale, instead of columns on shows
/**
 * Нормалізовані переклади текстів за локалями.
 */
export const showTranslations = pgTable(
  'show_translations',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    locale: text('locale').notNull(), // e.g., 'uk-UA', 'en-US'
    title: text('title'),
    overview: text('overview'),
    tagline: text('tagline'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_translations_unique_idx').on(table.showId, table.locale),
      showIdIdx: index('show_translations_show_id_idx').on(table.showId),
      localeIdx: index('show_translations_locale_idx').on(table.locale),
    };
  }
);

/**
 * Нормалізовані переклади фільмів за локалями.
 */
export const movieTranslations = pgTable(
  'movie_translations',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    locale: text('locale').notNull(),
    title: text('title'),
    overview: text('overview'),
    tagline: text('tagline'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_translations_unique_idx').on(table.movieId, table.locale),
      movieIdIdx: index('movie_translations_movie_id_idx').on(table.movieId),
      localeIdx: index('movie_translations_locale_idx').on(table.locale),
    };
  }
);

// Genre registry (TMDB driven) and relation to shows
/**
 * Реєстр жанрів TMDB.
 */
export const genres = pgTable(
  'genres',
  {
    id: serial('id').primaryKey(),
    tmdbId: integer('tmdb_id').notNull(),
    nameEn: text('name_en').notNull(),
    nameUk: text('name_uk'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      tmdbIdUniq: uniqueIndex('genres_tmdb_id_uniq_idx').on(table.tmdbId),
      nameEnIdx: index('genres_name_en_idx').on(table.nameEn),
    };
  }
);

/**
 * Зв’язок шоу ↔ жанр.
 */
export const showGenres = pgTable(
  'show_genres',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    genreId: integer('genre_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_genres_unique_idx').on(table.showId, table.genreId),
      showIdIdx: index('show_genres_show_id_idx').on(table.showId),
      genreIdIdx: index('show_genres_genre_id_idx').on(table.genreId),
    };
  }
);

/**
 * Зв’язок фільм ↔ жанр.
 */
export const movieGenres = pgTable(
  'movie_genres',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    genreId: integer('genre_id').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_genres_unique_idx').on(table.movieId, table.genreId),
      movieIdIdx: index('movie_genres_movie_id_idx').on(table.movieId),
      genreIdIdx: index('movie_genres_genre_id_idx').on(table.genreId),
    };
  }
);

// Videos per show (trailers, teasers, clips)
/**
 * Відео для шоу (трейлери/тизери).
 */
export const showVideos = pgTable(
  'show_videos',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    site: text('site').notNull(), // 'YouTube', 'Vimeo', etc.
    key: text('key').notNull(), // video key on the site (e.g., YouTube id)
    name: text('name'),
    type: text('type'), // 'Trailer', 'Teaser', 'Clip', etc.
    locale: text('locale'), // e.g., 'uk-UA'
    official: boolean('official'),
    publishedAt: timestamp('published_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_videos_unique_idx').on(table.showId, table.site, table.key),
      showIdIdx: index('show_videos_show_id_idx').on(table.showId),
      siteIdx: index('show_videos_site_idx').on(table.site),
    };
  }
);

/**
 * Відео для фільму (трейлери/тизери).
 */
export const movieVideos = pgTable(
  'movie_videos',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    site: text('site').notNull(),
    key: text('key').notNull(),
    name: text('name'),
    type: text('type'),
    locale: text('locale'),
    official: boolean('official'),
    publishedAt: timestamp('published_at'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_videos_unique_idx').on(table.movieId, table.site, table.key),
      movieIdIdx: index('movie_videos_movie_id_idx').on(table.movieId),
      siteIdx: index('movie_videos_site_idx').on(table.site),
    };
  }
);

// Canonical registry of watch providers (TMDB-driven)
/**
 * Канонічний реєстр провайдерів перегляду TMDB.
 */
export const watchProvidersRegistry = pgTable(
  'watch_providers_registry',
  {
    id: serial('id').primaryKey(),
    tmdbId: integer('tmdb_id').notNull(),
    name: text('name').notNull(),
    logoPath: text('logo_path'),
    slug: text('slug'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      tmdbIdUniq: uniqueIndex('watch_providers_registry_tmdb_id_uniq_idx').on(table.tmdbId),
      nameIdx: index('watch_providers_registry_name_idx').on(table.name),
      slugIdx: index('watch_providers_registry_slug_idx').on(table.slug),
    };
  }
);

// Watch providers per show region
/**
 * Провайдери перегляду за регіоном та категорією.
 */
export const showWatchProviders = pgTable(
  'show_watch_providers',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    region: text('region').notNull(), // e.g., 'UA', 'US'
    providerId: integer('provider_id'), // TMDB provider id
    providerName: text('provider_name'),
    logoPath: text('logo_path'),
    linkUrl: text('link_url'), // deep link to provider page if available
    category: text('category'), // 'flatrate' | 'rent' | 'buy' | 'ads' | 'free'
    rank: integer('rank'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_watch_providers_unique_idx').on(
        table.showId,
        table.region,
        table.providerId,
        table.category
      ),
      showIdIdx: index('show_watch_providers_show_id_idx').on(table.showId),
      regionIdx: index('show_watch_providers_region_idx').on(table.region),
      categoryIdx: index('show_watch_providers_category_idx').on(table.category),
      providerNameIdx: index('show_watch_providers_provider_name_idx').on(table.providerName),
      showIdRegionCategoryIdx: index('show_watch_providers_show_id_region_category_idx').on(
        table.showId,
        table.region,
        table.category
      ),
    };
  }
);

/**
 * Провайдери перегляду фільмів за регіоном та категорією.
 */
export const movieWatchProviders = pgTable(
  'movie_watch_providers',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    region: text('region').notNull(),
    providerId: integer('provider_id'),
    providerName: text('provider_name'),
    logoPath: text('logo_path'),
    linkUrl: text('link_url'),
    category: text('category'),
    rank: integer('rank'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_watch_providers_unique_idx').on(
        table.movieId,
        table.region,
        table.providerId,
        table.category
      ),
      movieIdIdx: index('movie_watch_providers_movie_id_idx').on(table.movieId),
      regionIdx: index('movie_watch_providers_region_idx').on(table.region),
      categoryIdx: index('movie_watch_providers_category_idx').on(table.category),
      providerNameIdx: index('movie_watch_providers_provider_name_idx').on(table.providerName),
      movieIdRegionCategoryIdx: index('movie_watch_providers_movie_id_region_category_idx').on(
        table.movieId,
        table.region,
        table.category
      ),
    };
  }
);

// Cast per show
/**
 * Каст шоу (персони та ролі).
 */
export const showCast = pgTable(
  'show_cast',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    personId: integer('person_id'), // TMDB person id
    name: text('name'),
    character: text('character'),
    order: integer('order'),
    profilePath: text('profile_path'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_cast_unique_idx').on(table.showId, table.personId, table.character),
      showIdIdx: index('show_cast_show_id_idx').on(table.showId),
      personIdIdx: index('show_cast_person_id_idx').on(table.personId),
    };
  }
);

/**
 * Каст фільму (персони та ролі).
 */
export const movieCast = pgTable(
  'movie_cast',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    personId: integer('person_id'),
    name: text('name'),
    character: text('character'),
    order: integer('order'),
    profilePath: text('profile_path'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_cast_unique_idx').on(table.movieId, table.personId, table.character),
      movieIdIdx: index('movie_cast_movie_id_idx').on(table.movieId),
      personIdIdx: index('movie_cast_person_id_idx').on(table.personId),
    };
  }
);

// Content ratings per region (e.g., TV-MA)
/**
 * Вікові рейтинги по регіонах (UA, US, ...).
 */
export const showContentRatings = pgTable(
  'show_content_ratings',
  {
    id: serial('id').primaryKey(),
    showId: integer('show_id').notNull(),
    region: text('region').notNull(), // e.g., 'US', 'UA'
    rating: text('rating'), // e.g., 'TV-MA'
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('show_content_ratings_unique_idx').on(table.showId, table.region),
      showIdIdx: index('show_content_ratings_show_id_idx').on(table.showId),
      regionIdx: index('show_content_ratings_region_idx').on(table.region),
    };
  }
);

/**
 * Вікові рейтинги фільмів по регіонах (UA, US, ...).
 */
export const movieContentRatings = pgTable(
  'movie_content_ratings',
  {
    id: serial('id').primaryKey(),
    movieId: integer('movie_id').notNull(),
    region: text('region').notNull(),
    rating: text('rating'),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniq: uniqueIndex('movie_content_ratings_unique_idx').on(table.movieId, table.region),
      movieIdIdx: index('movie_content_ratings_movie_id_idx').on(table.movieId),
      regionIdx: index('movie_content_ratings_region_idx').on(table.region),
    };
  }
);

// Sync jobs and tasks to orchestrate batched processing
/**
 * Джоби синхронізації (type/status/stats).
 */
export const syncJobs = pgTable('sync_jobs', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // e.g., 'trending'
  status: text('status').notNull().default('pending'), // 'pending' | 'running' | 'done' | 'error'
  stats: jsonb('stats'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/**
 * Задачі синхронізації для шоу (по TMDB ID).
 */
export const syncTasks = pgTable(
  'sync_tasks',
  {
    id: serial('id').primaryKey(),
    jobId: integer('job_id').notNull(),
    tmdbId: integer('tmdb_id').notNull(),
    payload: jsonb('payload'), // trimmed Trakt item, watchers, etc.
    status: text('status').notNull().default('pending'), // 'pending' | 'processing' | 'done' | 'error'
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      uniqTask: uniqueIndex('sync_tasks_job_tmdb_uniq_idx').on(table.jobId, table.tmdbId),
      jobStatusIdx: index('sync_tasks_job_status_idx').on(table.jobId, table.status),
      tmdbIdx: index('sync_tasks_tmdb_idx').on(table.tmdbId),
    };
  }
);

/**
 * Запити фіч користувачів для з підрахунком голосів.
 */
export const featureRequests = pgTable(
  'feature_requests',
  {
    id: serial('id').primaryKey(),
    title: text('title').notNull(),
    brief: text('brief'),
    description: text('description'),
    tags: jsonb('tags'),
    status: text('status').notNull().default('submitted'),
    votes: integer('votes').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => {
    return {
      statusIdx: index('feature_requests_status_idx').on(table.status),
      votesIdx: index('feature_requests_votes_idx').on(table.votes),
      createdIdx: index('feature_requests_created_idx').on(table.createdAt),
    };
  }
);

export type Show = typeof shows.$inferSelect;
export type NewShow = typeof shows.$inferInsert;
export type Movie = typeof movies.$inferSelect;
export type NewMovie = typeof movies.$inferInsert;
export type Airing = typeof showAirings.$inferSelect;
export type NewAiring = typeof showAirings.$inferInsert;
export type ShowRelated = typeof showRelated.$inferSelect;
export type NewShowRelated = typeof showRelated.$inferInsert;
export type MovieRelated = typeof movieRelated.$inferSelect;
export type NewMovieRelated = typeof movieRelated.$inferInsert;
export type ShowRatings = typeof showRatings.$inferSelect;
export type NewShowRatings = typeof showRatings.$inferInsert;
export type MovieRatings = typeof movieRatings.$inferSelect;
export type NewMovieRatings = typeof movieRatings.$inferInsert;
export type ShowRatingBucket = typeof showRatingBuckets.$inferSelect;
export type NewShowRatingBucket = typeof showRatingBuckets.$inferInsert;
export type MovieRatingBucket = typeof movieRatingBuckets.$inferSelect;
export type NewMovieRatingBucket = typeof movieRatingBuckets.$inferInsert;
export type ShowWatchersSnapshot = typeof showWatchersSnapshots.$inferSelect;
export type NewShowWatchersSnapshot = typeof showWatchersSnapshots.$inferInsert;
export type MovieWatchersSnapshot = typeof movieWatchersSnapshots.$inferSelect;
export type NewMovieWatchersSnapshot = typeof movieWatchersSnapshots.$inferInsert;

export type ShowTranslation = typeof showTranslations.$inferSelect;
export type NewShowTranslation = typeof showTranslations.$inferInsert;
export type MovieTranslation = typeof movieTranslations.$inferSelect;
export type NewMovieTranslation = typeof movieTranslations.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type NewGenre = typeof genres.$inferInsert;
export type ShowGenre = typeof showGenres.$inferSelect;
export type NewShowGenre = typeof showGenres.$inferInsert;
export type MovieGenre = typeof movieGenres.$inferSelect;
export type NewMovieGenre = typeof movieGenres.$inferInsert;
export type ShowVideo = typeof showVideos.$inferSelect;
export type NewShowVideo = typeof showVideos.$inferInsert;
export type MovieVideo = typeof movieVideos.$inferSelect;
export type NewMovieVideo = typeof movieVideos.$inferInsert;
export type WatchProviderRegistry = typeof watchProvidersRegistry.$inferSelect;
export type NewWatchProviderRegistry = typeof watchProvidersRegistry.$inferInsert;
export type ShowWatchProvider = typeof showWatchProviders.$inferSelect;
export type NewShowWatchProvider = typeof showWatchProviders.$inferInsert;
export type MovieWatchProvider = typeof movieWatchProviders.$inferSelect;
export type NewMovieWatchProvider = typeof movieWatchProviders.$inferInsert;
export type ShowCast = typeof showCast.$inferSelect;
export type NewShowCast = typeof showCast.$inferInsert;
export type MovieCast = typeof movieCast.$inferSelect;
export type NewMovieCast = typeof movieCast.$inferInsert;
export type ShowContentRating = typeof showContentRatings.$inferSelect;
export type NewShowContentRating = typeof showContentRatings.$inferInsert;
export type MovieContentRating = typeof movieContentRatings.$inferSelect;
export type NewMovieContentRating = typeof movieContentRatings.$inferInsert;
export type SyncJob = typeof syncJobs.$inferSelect;
export type NewSyncJob = typeof syncJobs.$inferInsert;
export type SyncTask = typeof syncTasks.$inferSelect;
export type NewSyncTask = typeof syncTasks.$inferInsert;
export type FeatureRequest = typeof featureRequests.$inferSelect;
export type NewFeatureRequest = typeof featureRequests.$inferInsert;
