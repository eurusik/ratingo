import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  boolean,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';

import { episodes, mediaItems } from './media';
import { users } from './users';

export const userMediaStatusEnum = pgEnum('user_media_status', [
  'watching',
  'completed',
  'planned',
  'dropped',
  'paused',
  'caught_up',
]);

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
    progress: jsonb('progress').$type<Record<string, unknown> | null>(),
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

/**
 * USER NOTIFICATIONS
 * Stores actual notification events triggered by subscriptions.
 * Separate from subscriptions - these are "things that happened".
 */
export const userNotifications = pgTable(
  'user_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    mediaItemId: uuid('media_item_id')
      .references(() => mediaItems.id, { onDelete: 'cascade' })
      .notNull(),
    subscriptionId: uuid('subscription_id')
      .references(() => userSubscriptions.id, { onDelete: 'cascade' })
      .notNull(),

    // What triggered this notification
    trigger: subscriptionTriggerEnum('trigger').notNull(),

    // Event-specific payload (seasonNumber, episodeKey, etc.)
    payload: jsonb('payload').$type<{
      seasonNumber?: number;
      episodeKey?: string;
      airDate?: string;
      statusFrom?: string | null;
      statusTo?: string;
    }>(),

    // Read status
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index('user_notifications_user_idx').on(t.userId),
    userUnreadIdx: index('user_notifications_user_unread_idx').on(t.userId, t.isRead),
    createdAtIdx: index('user_notifications_created_at_idx').on(t.createdAt),
    // Prevent duplicate notifications for same event
    uniqUserMediaTriggerPayload: uniqueIndex('user_notifications_dedup_idx').on(
      t.userId,
      t.mediaItemId,
      t.trigger,
      t.payload,
    ),
  }),
);

export const userNotificationsRelations = relations(userNotifications, ({ one }) => ({
  user: one(users, {
    fields: [userNotifications.userId],
    references: [users.id],
  }),
  media: one(mediaItems, {
    fields: [userNotifications.mediaItemId],
    references: [mediaItems.id],
  }),
  subscription: one(userSubscriptions, {
    fields: [userNotifications.subscriptionId],
    references: [userSubscriptions.id],
  }),
}));

// --- USER EPISODE PROGRESS (Watch Tracking) ---

/**
 * User episode watch progress.
 * Tracks which episodes a user has watched.
 * Composite primary key: (user_id, episode_id).
 */
export const userEpisodeProgress = pgTable(
  'user_episode_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    episodeId: uuid('episode_id')
      .notNull()
      .references(() => episodes.id, { onDelete: 'cascade' }),
    watchedAt: timestamp('watched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.episodeId] }),
    userIdx: index('user_episode_progress_user_idx').on(t.userId),
    episodeIdx: index('user_episode_progress_episode_idx').on(t.episodeId),
  }),
);

// --- USER EPISODE PROGRESS RELATIONS ---

export const userEpisodeProgressRelations = relations(userEpisodeProgress, ({ one }) => ({
  user: one(users, {
    fields: [userEpisodeProgress.userId],
    references: [users.id],
  }),
  episode: one(episodes, {
    fields: [userEpisodeProgress.episodeId],
    references: [episodes.id],
  }),
}));
