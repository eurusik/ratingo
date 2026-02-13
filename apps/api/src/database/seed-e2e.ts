/**
 * E2E seed script — populates notifications data for the test user.
 *
 * Usage:  npx tsx src/database/seed-e2e.ts
 * Requires: DATABASE_URL env var or ../../.env file
 */

import * as path from 'path';

import * as dotenv from 'dotenv';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

const TEST_EMAIL = 'e2e@ratingo.test';

async function seed() {
  const sql = postgres(process.env.DATABASE_URL!);
  const db = drizzle(sql, { schema });

  // 1. Resolve test user
  const [user] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, TEST_EMAIL))
    .limit(1);

  if (!user) {
    console.error(`Test user ${TEST_EMAIL} not found. Register first via POST /api/auth/register.`);
    await sql.end();
    process.exit(1);
  }

  console.log(`Found test user: ${user.id}`);

  // 2. Get existing media items (need at least 3)
  const mediaItems = await db
    .select({
      id: schema.mediaItems.id,
      title: schema.mediaItems.title,
      type: schema.mediaItems.type,
    })
    .from(schema.mediaItems)
    .limit(5);

  if (mediaItems.length < 2) {
    console.error('Need at least 2 media items in the DB. Run ingestion first.');
    await sql.end();
    process.exit(1);
  }

  console.log(
    `Found ${mediaItems.length} media items: ${mediaItems.map((m) => m.title).join(', ')}`,
  );

  // 3. Clean up existing seed data for test user
  await db.delete(schema.userNotifications).where(eq(schema.userNotifications.userId, user.id));
  await db.delete(schema.userSubscriptions).where(eq(schema.userSubscriptions.userId, user.id));
  await db.delete(schema.userMediaState).where(eq(schema.userMediaState.userId, user.id));
  console.log('Cleaned existing data for test user');

  // 4. Create user_media_state entries (watching / completed)
  const states: { mediaItemId: string; state: 'watching' | 'completed' }[] = [
    { mediaItemId: mediaItems[0].id, state: 'watching' },
    ...(mediaItems[1] ? [{ mediaItemId: mediaItems[1].id, state: 'watching' as const }] : []),
    ...(mediaItems[2] ? [{ mediaItemId: mediaItems[2].id, state: 'completed' as const }] : []),
  ];

  for (const s of states) {
    await db.insert(schema.userMediaState).values({
      userId: user.id,
      mediaItemId: s.mediaItemId,
      state: s.state,
    });
  }
  console.log(`Created ${states.length} user_media_state entries`);

  // 5. Create subscriptions
  const triggers = ['new_season', 'new_episode'] as const;
  const subscriptionIds: { mediaItemId: string; trigger: string; id: string }[] = [];

  for (const mi of mediaItems.slice(0, 3)) {
    for (const trigger of triggers) {
      const [sub] = await db
        .insert(schema.userSubscriptions)
        .values({
          userId: user.id,
          mediaItemId: mi.id,
          trigger,
          isActive: true,
        })
        .returning({ id: schema.userSubscriptions.id });
      subscriptionIds.push({ mediaItemId: mi.id, trigger, id: sub.id });
    }
  }
  console.log(`Created ${subscriptionIds.length} subscriptions`);

  // 6. Create notifications (mix of read/unread, different triggers & payloads)
  const now = new Date();
  const notifications: {
    mediaItemId: string;
    subscriptionId: string;
    trigger: 'new_season' | 'new_episode';
    payload: Record<string, unknown>;
    isRead: boolean;
    createdAt: Date;
  }[] = [];

  // Media item 0 — new_season notification (unread)
  const sub0Season = subscriptionIds.find(
    (s) => s.mediaItemId === mediaItems[0].id && s.trigger === 'new_season',
  )!;
  notifications.push({
    mediaItemId: mediaItems[0].id,
    subscriptionId: sub0Season.id,
    trigger: 'new_season',
    payload: { seasonNumber: 2 },
    isRead: false,
    createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), // 1h ago
  });

  // Media item 0 — new_episode notification (unread)
  const sub0Episode = subscriptionIds.find(
    (s) => s.mediaItemId === mediaItems[0].id && s.trigger === 'new_episode',
  )!;
  notifications.push({
    mediaItemId: mediaItems[0].id,
    subscriptionId: sub0Episode.id,
    trigger: 'new_episode',
    payload: { seasonNumber: 1, episodeKey: 'S1E5', airDate: '2025-03-15' },
    isRead: false,
    createdAt: new Date(now.getTime() - 30 * 60 * 1000), // 30m ago
  });

  if (mediaItems[1]) {
    // Media item 1 — new_episode (read)
    const sub1Episode = subscriptionIds.find(
      (s) => s.mediaItemId === mediaItems[1].id && s.trigger === 'new_episode',
    )!;
    notifications.push({
      mediaItemId: mediaItems[1].id,
      subscriptionId: sub1Episode.id,
      trigger: 'new_episode',
      payload: { seasonNumber: 1, episodeKey: 'S1E3', airDate: '2025-02-10' },
      isRead: true,
      createdAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    });

    // Media item 1 — new_season (unread)
    const sub1Season = subscriptionIds.find(
      (s) => s.mediaItemId === mediaItems[1].id && s.trigger === 'new_season',
    )!;
    notifications.push({
      mediaItemId: mediaItems[1].id,
      subscriptionId: sub1Season.id,
      trigger: 'new_season',
      payload: { seasonNumber: 3 },
      isRead: false,
      createdAt: new Date(now.getTime() - 3 * 60 * 60 * 1000), // 3h ago
    });
  }

  if (mediaItems[2]) {
    // Media item 2 — new_episode (read, older)
    const sub2Episode = subscriptionIds.find(
      (s) => s.mediaItemId === mediaItems[2].id && s.trigger === 'new_episode',
    )!;
    notifications.push({
      mediaItemId: mediaItems[2].id,
      subscriptionId: sub2Episode.id,
      trigger: 'new_episode',
      payload: { seasonNumber: 2, episodeKey: 'S2E1', airDate: '2025-01-20' },
      isRead: true,
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 1 week ago
    });

    // Media item 2 — new_season (unread)
    const sub2Season = subscriptionIds.find(
      (s) => s.mediaItemId === mediaItems[2].id && s.trigger === 'new_season',
    )!;
    notifications.push({
      mediaItemId: mediaItems[2].id,
      subscriptionId: sub2Season.id,
      trigger: 'new_season',
      payload: { seasonNumber: 1 },
      isRead: false,
      createdAt: new Date(now.getTime() - 5 * 60 * 60 * 1000), // 5h ago
    });
  }

  for (const n of notifications) {
    await db.insert(schema.userNotifications).values({
      userId: user.id,
      mediaItemId: n.mediaItemId,
      subscriptionId: n.subscriptionId,
      trigger: n.trigger,
      payload: n.payload,
      isRead: n.isRead,
      readAt: n.isRead ? n.createdAt : null,
      createdAt: n.createdAt,
    });
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  console.log(
    `Created ${notifications.length} notifications (${unreadCount} unread, ${notifications.length - unreadCount} read)`,
  );

  // 7. Ensure autoSubscribeOnWatch is enabled for test user
  await db
    .update(schema.users)
    .set({ autoSubscribeOnWatch: true })
    .where(eq(schema.users.id, user.id));
  console.log('Ensured autoSubscribeOnWatch = true');

  console.log('\nSeed complete!');
  await sql.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
