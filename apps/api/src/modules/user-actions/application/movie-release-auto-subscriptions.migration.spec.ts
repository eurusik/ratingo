import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { MOVIE_DIGITAL_RELEASE_AWAIT_DAYS } from '../domain/constants/subscription.constants';

const MIGRATION_PATH = join(
  __dirname,
  '../../../../drizzle_v2/0035_movie_release_auto_subscriptions.sql',
);

const migration = readFileSync(MIGRATION_PATH, 'utf8');

describe('movie release auto-subscription backfill', () => {
  it('waits for a digital release as long as live auto-subscribe does', () => {
    expect(migration).toContain(`::date - ${MOVIE_DIGITAL_RELEASE_AWAIT_DAYS}`);
  });

  it('reads the release date in the same order as the catalog', () => {
    expect(migration).toContain(
      'coalesce(m."theatrical_release_date", m."digital_release_date", mi."release_date")',
    );
  });

  it('counts days in UTC like the notifier', () => {
    expect(migration).not.toContain('current_date');
    expect(migration).toContain(`(now() AT TIME ZONE 'utc')::date`);
  });

  it('honours the auto-subscribe preference and never revives a subscription', () => {
    expect(migration).toContain('"auto_subscribe_on_watch" IS TRUE');
    expect(migration).toContain(
      'ON CONFLICT ("user_id", "media_item_id", "trigger", "channel") DO NOTHING',
    );
  });
});
