import { pgTable, text, timestamp, boolean, pgEnum, uuid } from 'drizzle-orm/pg-core';

export const userRoleEnum = pgEnum('user_role', ['user', 'admin']);

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
  autoSubscribeOnWatch: boolean('auto_subscribe_on_watch').default(true),
  role: userRoleEnum('role').default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
});
