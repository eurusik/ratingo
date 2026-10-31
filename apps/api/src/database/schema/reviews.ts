import { relations, sql } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
} from 'drizzle-orm/pg-core';

import { mediaItems } from './media';
import { users } from './users';

// --- REVIEWS ---

/**
 * Vote type for reviews: like or dislike.
 */
export const reviewVoteTypeEnum = pgEnum('review_vote_type', ['like', 'dislike']);

/**
 * Report reason for reviews.
 */
export const reviewReportReasonEnum = pgEnum('review_report_reason', [
  'spam',
  'harassment',
  'hate_speech',
  'misinformation',
  'spoiler_unmarked',
  'other',
]);

/**
 * Report status for moderation workflow.
 */
export const reviewReportStatusEnum = pgEnum('review_report_status', [
  'pending',
  'reviewed',
  'dismissed',
  'actioned',
]);

/**
 * User reviews for movies and shows.
 * Short tweet-like reviews (max 280 chars) with rating.
 */
export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    content: varchar('content', { length: 280 }).notNull(),
    rating: integer('rating').notNull(), // 0-100
    hasSpoiler: boolean('has_spoiler').default(false).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    likesCount: integer('likes_count').default(0).notNull(),
    dislikesCount: integer('dislikes_count').default(0).notNull(),
    repliesCount: integer('replies_count').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => ({
    userMediaUniq: uniqueIndex('reviews_user_media_uniq')
      .on(t.userId, t.mediaItemId)
      .where(sql`${t.isDeleted} = false`),
    mediaIdx: index('reviews_media_idx').on(t.mediaItemId, t.createdAt),
    userIdx: index('reviews_user_idx').on(t.userId, t.createdAt),
  }),
);

/**
 * Like/dislike votes on reviews.
 * One vote per user per review.
 */
export const reviewVotes = pgTable(
  'review_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .references(() => reviews.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    voteType: reviewVoteTypeEnum('vote_type').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userReviewUniq: uniqueIndex('review_votes_user_review_uniq').on(t.userId, t.reviewId),
    reviewIdx: index('review_votes_review_idx').on(t.reviewId),
  }),
);

/**
 * Replies to reviews (nested comments).
 * Max 2 levels of nesting.
 */
export const reviewReplies = pgTable(
  'review_replies',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .references(() => reviews.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    parentReplyId: uuid('parent_reply_id'),
    replyToUsername: varchar('reply_to_username', { length: 50 }),
    content: varchar('content', { length: 280 }).notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    reviewIdx: index('review_replies_review_idx').on(t.reviewId, t.createdAt),
    parentIdx: index('review_replies_parent_idx').on(t.parentReplyId),
  }),
);

/**
 * Reports on reviews for moderation.
 * One report per user per review.
 */
export const reviewReports = pgTable(
  'review_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    reviewId: uuid('review_id')
      .references(() => reviews.id, { onDelete: 'cascade' })
      .notNull(),
    reporterId: uuid('reporter_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    reason: reviewReportReasonEnum('reason').notNull(),
    details: text('details'),
    status: reviewReportStatusEnum('status').default('pending').notNull(),
    moderatorId: uuid('moderator_id').references(() => users.id),
    moderatorNotes: text('moderator_notes'),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    reporterReviewUniq: uniqueIndex('review_reports_reporter_review_uniq').on(
      t.reporterId,
      t.reviewId,
    ),
    statusIdx: index('review_reports_status_idx').on(t.status, t.createdAt),
  }),
);

// --- REVIEWS RELATIONS ---

export const reviewsRelations = relations(reviews, ({ one, many }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [reviews.mediaItemId],
    references: [mediaItems.id],
  }),
  votes: many(reviewVotes),
  replies: many(reviewReplies),
  reports: many(reviewReports),
}));

export const reviewVotesRelations = relations(reviewVotes, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewVotes.reviewId],
    references: [reviews.id],
  }),
  user: one(users, {
    fields: [reviewVotes.userId],
    references: [users.id],
  }),
}));

export const reviewRepliesRelations = relations(reviewReplies, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewReplies.reviewId],
    references: [reviews.id],
  }),
  user: one(users, {
    fields: [reviewReplies.userId],
    references: [users.id],
  }),
  parent: one(reviewReplies, {
    fields: [reviewReplies.parentReplyId],
    references: [reviewReplies.id],
    relationName: 'parent_child',
  }),
}));

export const reviewReportsRelations = relations(reviewReports, ({ one }) => ({
  review: one(reviews, {
    fields: [reviewReports.reviewId],
    references: [reviews.id],
  }),
  reporter: one(users, {
    fields: [reviewReports.reporterId],
    references: [users.id],
  }),
  moderator: one(users, {
    fields: [reviewReports.moderatorId],
    references: [users.id],
  }),
}));
