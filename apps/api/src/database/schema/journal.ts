import { relations, sql } from 'drizzle-orm';
import { pgTable, text, timestamp, boolean, index, pgEnum, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

// --- JOURNAL (Product Chronicle) ---

/**
 * Post type enum for journal posts.
 * - update: "Що нового" - product updates
 * - explanation: "Як це працює" - feature explanations
 * - fix: "Виправлено" - bug fixes
 * - roadmap: "Що далі" - future plans
 */
export const postTypeEnum = pgEnum('post_type', ['update', 'explanation', 'fix', 'roadmap']);

/**
 * JOURNAL POSTS
 * Product chronicle posts for transparency and communication.
 * Supports drafts, scheduled publishing, and context linking.
 */
export const journalPosts = pgTable(
  'journal_posts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    bodyHtml: text('body_html').notNull(),
    excerpt: text('excerpt').notNull(),
    type: postTypeEnum('type').notNull(),
    featuredImageUrl: text('featured_image_url'),
    contextId: text('context_id'),
    metaTitle: text('meta_title'),
    metaDescription: text('meta_description'),
    isDraft: boolean('is_draft').notNull().default(true),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    authorId: uuid('author_id')
      .references(() => users.id)
      .notNull(),
  },
  (t) => ({
    // Note: slug index not needed - UNIQUE constraint creates btree index automatically
    typeIdx: index('idx_journal_posts_type').on(t.type),
    contextIdx: index('idx_journal_posts_context')
      .on(t.contextId)
      .where(sql`${t.contextId} IS NOT NULL`),
    publishedIdx: index('idx_journal_posts_published')
      .on(t.publishedAt, t.createdAt)
      .where(sql`${t.isDraft} = false`),
  }),
);

// --- JOURNAL RELATIONS ---

export const journalPostsRelations = relations(journalPosts, ({ one }) => ({
  author: one(users, {
    fields: [journalPosts.authorId],
    references: [users.id],
  }),
}));
