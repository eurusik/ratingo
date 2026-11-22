\set ON_ERROR_STOP on

BEGIN;

INSERT INTO users (id, email, username, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001', 'a@example.test', 'a', '2026-01-10 21:30:00'),
  ('00000000-0000-0000-0000-000000000002', 'b@example.test', 'b', '2026-01-10 22:30:00'),
  ('00000000-0000-0000-0000-000000000003', 'c@example.test', 'c', '2026-01-11 09:00:00');

INSERT INTO users (id, email, username, created_at, deleted_at) VALUES
  ('00000000-0000-0000-0000-000000000004', 'd@example.test', 'd', '2026-01-11 10:00:00', '2026-01-20 10:00:00');

INSERT INTO media_items (id, type, tmdb_id, title, slug, created_at, last_synced_at) VALUES
  ('10000000-0000-0000-0000-000000000001', 'movie', 1, 'M1', 'm1', '2026-01-01 10:00:00', '2026-01-05 10:00:00'),
  ('10000000-0000-0000-0000-000000000002', 'movie', 2, 'M2', 'm2', '2026-01-02 10:00:00', '2026-01-07 10:00:00'),
  ('10000000-0000-0000-0000-000000000003', 'movie', 3, 'M3', 'm3', '2026-01-03 10:00:00', NULL);

INSERT INTO media_items (id, type, tmdb_id, title, slug, created_at, deleted_at) VALUES
  ('10000000-0000-0000-0000-000000000004', 'movie', 4, 'M4', 'm4', '2026-01-09 10:00:00', '2026-01-09 12:00:00');

INSERT INTO user_media_state (user_id, media_item_id, state, rating, state_implied, created_at, updated_at) VALUES
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'completed', 80, false, '2026-01-11 10:00:00', '2026-01-11 10:00:00'),
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'watching', NULL, true, '2026-01-11 11:00:00', '2026-01-11 11:00:00'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'completed', 90, false, '2026-01-05 10:00:00', '2026-01-13 10:00:00');

INSERT INTO reviews (user_id, media_item_id, content, rating, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'ok', 70, '2026-01-11 12:00:00+00');

INSERT INTO reviews (user_id, media_item_id, content, rating, is_deleted, created_at) VALUES
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'gone', 10, true, '2026-01-11 12:00:00+00');

INSERT INTO user_media_actions (user_id, media_item_id, action, created_at) VALUES
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'save_for_later', '2026-01-11 13:00:00'),
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'consider', '2026-01-11 13:05:00'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'subscribe', '2026-01-11 14:00:00'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'unsave', '2026-01-11 14:30:00');

INSERT INTO import_batches (user_id, source, total_items, created_at) VALUES
  ('00000000-0000-0000-0000-000000000003', 'kinobaza', 5, '2026-01-12 00:00:00+00');

CREATE TEMP TABLE expected (name text, ok boolean);

INSERT INTO expected
SELECT 'a 21:30 UTC signup stays on 2026-01-10 in Kyiv' AS name,
  (SELECT new_users FROM reporting.daily_new_users WHERE day = '2026-01-10') = 1
UNION ALL SELECT 'a 22:30 UTC signup rolls over to 2026-01-11 in Kyiv',
  (SELECT new_users FROM reporting.daily_new_users WHERE day = '2026-01-11') = 3
UNION ALL SELECT 'soft-deleted users still count as signups',
  (SELECT new_users FROM reporting.daily_new_users WHERE day = '2026-01-11') = 3
UNION ALL SELECT 'ratings counted on the day the rated state was created',
  (SELECT actions FROM reporting.daily_user_actions WHERE day = '2026-01-11' AND kind = 'rating') = 1
UNION ALL SELECT 'a later update of a rated state is not a new rating or activity',
  NOT EXISTS (SELECT 1 FROM reporting.daily_user_actions WHERE day = '2026-01-13')
  AND NOT EXISTS (SELECT 1 FROM reporting.daily_active_users WHERE day = '2026-01-13')
UNION ALL SELECT 'implied watch state excluded',
  (SELECT actions FROM reporting.daily_user_actions WHERE day = '2026-01-11' AND kind = 'watch_state') = 1
UNION ALL SELECT 'deleted review excluded',
  (SELECT actions FROM reporting.daily_user_actions WHERE day = '2026-01-11' AND kind = 'review') = 1
UNION ALL SELECT 'saves count save_for_later and consider by distinct user',
  (SELECT (actions, users) FROM reporting.daily_user_actions WHERE day = '2026-01-11' AND kind = 'save') = ROW(2, 1)
UNION ALL SELECT 'subscriptions counted, unsave ignored',
  (SELECT actions FROM reporting.daily_user_actions WHERE day = '2026-01-11' AND kind = 'subscription') = 1
UNION ALL SELECT 'import batch lands on the Kyiv day',
  (SELECT actions FROM reporting.daily_user_actions WHERE day = '2026-01-12' AND kind = 'import') = 1
UNION ALL SELECT 'active users on 2026-01-11 are all three users',
  (SELECT active_users FROM reporting.daily_active_users WHERE day = '2026-01-11') = 3
UNION ALL SELECT 'catalog freshness ignores deleted items',
  (SELECT (items_total, newest_item_at, last_synced_at) FROM reporting.catalog_freshness)
    = ROW(3, '2026-01-03 10:00:00+00'::timestamptz, '2026-01-07 10:00:00+00'::timestamptz);

SELECT name, ok FROM expected WHERE NOT ok OR ok IS NULL;
SELECT count(*) FILTER (WHERE ok) AS passed, count(*) AS total FROM expected;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM expected WHERE ok IS DISTINCT FROM true) THEN
    RAISE EXCEPTION 'reporting view expectations failed';
  END IF;
END
$$;

SET LOCAL ROLE ai_reader;

DO $$
DECLARE
  view_name text;
BEGIN
  FOREACH view_name IN ARRAY ARRAY['daily_new_users', 'daily_user_actions', 'daily_active_users', 'catalog_freshness'] LOOP
    EXECUTE format('SELECT count(*) FROM reporting.%I', view_name);
  END LOOP;
END
$$;

DO $$
DECLARE
  denied text;
BEGIN
  FOREACH denied IN ARRAY ARRAY['public.users', 'public.media_items', 'reporting.internal_user_events'] LOOP
    BEGIN
      EXECUTE format('SELECT count(*) FROM %s', denied);
      RAISE EXCEPTION 'ai_reader can read %', denied;
    EXCEPTION WHEN insufficient_privilege THEN
      NULL;
    END;
  END LOOP;
END
$$;

RESET ROLE;

ROLLBACK;
