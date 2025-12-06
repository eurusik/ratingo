import {
  pgTable,
  serial,
  text,
  integer,
  doublePrecision,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';

// --- ENUMS ---
export const mediaTypeEnum = pgEnum('media_type', [MediaType.MOVIE, MediaType.SHOW]);
export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

// --- CORE CATALOG ---

/**
 * MEDIA ITEMS (Base Table)
 */
export const mediaItems = pgTable(
  'media_items',
  {
    id: serial('id').primaryKey(),
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
    
    // Metrics (Denormalized for speed)
    trendingScore: doublePrecision('trending_score').default(0),
    popularity: doublePrecision('popularity').default(0),
    rating: doublePrecision('rating').default(0),
    voteCount: integer('vote_count').default(0),
    
    // Metadata
    releaseDate: timestamp('release_date'),
    isAdult: boolean('is_adult').default(false),
    
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    typeIdx: index('media_type_idx').on(t.type),
    trendingIdx: index('media_trending_idx').on(t.trendingScore),
    popularityIdx: index('media_popularity_idx').on(t.popularity),
    releaseDateIdx: index('media_release_date_idx').on(t.releaseDate),
    slugIdx: uniqueIndex('media_slug_idx').on(t.slug),
  })
);

/**
 * MOVIES (Details)
 */
export const movies = pgTable('movies', {
  id: serial('id').primaryKey(),
  mediaItemId: integer('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
    
  runtime: integer('runtime'),
  budget: integer('budget'),
  revenue: integer('revenue'),
  status: text('status'),
});

/**
 * SHOWS (Details)
 */
export const shows = pgTable('shows', {
  id: serial('id').primaryKey(),
  mediaItemId: integer('media_item_id')
    .references(() => mediaItems.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
    
  totalSeasons: integer('total_seasons'),
  totalEpisodes: integer('total_episodes'),
  status: text('status'),
  lastAirDate: timestamp('last_air_date'),
  nextAirDate: timestamp('next_air_date'),
});

// --- GENRES ---

export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  tmdbId: integer('tmdb_id').unique().notNull(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
});

export const mediaGenres = pgTable(
  'media_genres',
  {
    id: serial('id').primaryKey(),
    mediaItemId: integer('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    genreId: integer('genre_id')
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
  id: serial('id').primaryKey(),
  email: text('email').unique().notNull(),
  username: text('username').unique().notNull(),
  passwordHash: text('password_hash'),
  avatarUrl: text('avatar_url'),
  role: userRoleEnum('role').default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
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
