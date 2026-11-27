export interface AllowedName {
  table: string;
  column: string;
  reason: string;
}

export const WHOLE_TABLE = '*';

export const ALLOWED_SENSITIVE_NAMES: readonly AllowedName[] = [
  {
    table: 'user_media_actions',
    column: 'reason_key',
    reason: 'verdict key such as trendingNow, not a credential',
  },
  {
    table: 'user_saved_items',
    column: 'reason_key',
    reason: 'verdict key such as trendingNow, not a credential',
  },
  {
    table: 'user_subscriptions',
    column: 'last_notified_episode_key',
    reason: 'episode label such as S2E5, not a credential',
  },
  {
    table: 'key_health_checks',
    column: WHOLE_TABLE,
    reason: 'health of provider keys: status and quota only, the key itself is never stored',
  },
];

export const PRIVATE_TABLES: readonly string[] = [
  'refresh_tokens',
  'oauth_exchange_codes',
  'oauth_accounts',
];

export const CLOSED_COLUMNS: readonly { table: string; columns: readonly string[] }[] = [
  {
    table: 'users',
    columns: ['email', 'username', 'password_hash', 'avatar_url', 'bio', 'location', 'website'],
  },
  { table: 'user_media_state', columns: ['notes'] },
  { table: 'user_media_actions', columns: ['payload'] },
  { table: 'review_replies', columns: ['reply_to_username'] },
  { table: 'review_reports', columns: ['details', 'moderator_notes'] },
  { table: 'job_failure_days', columns: ['last_message'] },
  { table: 'key_health_checks', columns: ['detail'] },
  { table: 'catalog_evaluation_runs', columns: ['promoted_by', 'error_sample'] },
];
