import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  timestamp,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';

import { mediaItems } from './media';

// --- ENUMS ---

/** Distinguishes acting roles (cast) from production roles (crew). */
export const personCreditTypeEnum = pgEnum('person_credit_type', ['cast', 'crew']);

// --- PERSONS ---

/**
 * PERSONS (Actors, directors, crew)
 *
 * Canonical key is `tmdbId`. Basic fields (name, profilePath) are populated
 * during media ingest from the credits JSONB. The biography block is enriched
 * lazily from TMDB /person/{id} on first request — `detailsFetchedAt` acts as
 * the freshness marker (null = not yet enriched).
 */
export const persons = pgTable(
  'persons',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tmdbId: integer('tmdb_id').notNull().unique(),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    profilePath: text('profile_path'),
    knownForDepartment: text('known_for_department'),
    popularity: doublePrecision('popularity').default(0),

    // Enriched lazily from TMDB /person/{id}
    biography: text('biography'),
    birthday: timestamp('birthday'),
    deathday: timestamp('deathday'),
    placeOfBirth: text('place_of_birth'),
    detailsFetchedAt: timestamp('details_fetched_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => ({
    popularityIdx: index('persons_popularity_idx').on(t.popularity),
    slugIdx: index('persons_slug_idx').on(t.slug),
  }),
);

/**
 * MEDIA CREDITS (normalized read-model)
 *
 * Reverse-lookup link between media items and persons. The source of truth for
 * a title's credits remains `media_items.credits` (JSONB); this table exists so
 * we can answer "all works of person X" with an index, mirroring `media_genres`.
 */
export const mediaCredits = pgTable(
  'media_credits',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    personId: uuid('person_id')
      .references(() => persons.id, { onDelete: 'cascade' })
      .notNull(),
    creditType: personCreditTypeEnum('credit_type').notNull(),
    character: text('character'), // cast only
    job: text('job'), // crew only (Director, Writer, …)
    department: text('department'), // crew only (Directing, Writing, …)
    order: integer('order').default(0).notNull(),
  },
  (t) => ({
    // Idempotency: one row per (media, person, role, job). COALESCE keeps NULL jobs
    // (cast) from defeating uniqueness so re-ingest overwrites instead of duplicating.
    uniq: uniqueIndex('media_credits_uniq').on(
      t.mediaItemId,
      t.personId,
      t.creditType,
      sql`coalesce(${t.job}, '')`,
    ),
    personIdx: index('media_credits_person_idx').on(t.personId),
    mediaItemIdx: index('media_credits_media_item_idx').on(t.mediaItemId),
  }),
);

// --- RELATIONS ---

export const personsRelations = relations(persons, ({ many }) => ({
  credits: many(mediaCredits),
}));

export const mediaCreditsRelations = relations(mediaCredits, ({ one }) => ({
  media: one(mediaItems, {
    fields: [mediaCredits.mediaItemId],
    references: [mediaItems.id],
  }),
  person: one(persons, {
    fields: [mediaCredits.personId],
    references: [persons.id],
  }),
}));
