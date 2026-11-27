interface Reviewed {
  reason: string;
}

export interface AllowedColumn extends Reviewed {
  table: string;
  column: string;
}

export interface AllowedTable extends Reviewed {
  table: string;
}

export interface AllowedFreeFormColumns extends Reviewed {
  table: string;
  columns: readonly string[];
}

export const ALLOWED_SENSITIVE_TABLE_NAMES: readonly AllowedTable[] = [
  {
    table: 'public.key_health_checks',
    reason: 'health of provider keys: status and quota only, the key itself is never stored',
  },
];

export const ALLOWED_SENSITIVE_COLUMNS: readonly AllowedColumn[] = [
  {
    table: 'public.user_media_actions',
    column: 'reason_key',
    reason: 'verdict key such as trendingNow, not a credential',
  },
  {
    table: 'public.user_saved_items',
    column: 'reason_key',
    reason: 'verdict key such as trendingNow, not a credential',
  },
  {
    table: 'public.user_subscriptions',
    column: 'last_notified_episode_key',
    reason: 'episode label such as S2E5, not a credential',
  },
  {
    table: 'public.journal_posts',
    column: 'body',
    reason: 'text written by the owner and published on the site',
  },
  {
    table: 'public.journal_posts',
    column: 'body_html',
    reason: 'rendered text written by the owner and published on the site',
  },
  {
    table: 'public.provider_mappings',
    column: 'notes',
    reason: 'editorial note about a streaming provider mapping, written by the owner',
  },
];

export const ALLOWED_FREE_FORM_COLUMNS: readonly AllowedFreeFormColumns[] = [
  {
    table: 'public.user_media_state',
    columns: ['progress'],
    reason: 'watch progress json written by the application; unvalidated, follow-up',
  },
  {
    table: 'public.user_media_actions',
    columns: ['action', 'context', 'reason_key'],
    reason: 'action names and client-supplied context keys; unvalidated client text, follow-up',
  },
  {
    table: 'public.user_saved_items',
    columns: ['reason_key'],
    reason: 'verdict key chosen from a fixed list in the application',
  },
  {
    table: 'public.user_subscriptions',
    columns: ['channel', 'last_notified_episode_key'],
    reason: 'notification channel and episode label set by the application',
  },
  {
    table: 'public.user_notifications',
    columns: ['payload'],
    reason: 'event payload built by the application: season, episode, dates',
  },
  {
    table: 'public.import_pending_items',
    columns: ['imdb_id', 'media_type', 'state'],
    reason:
      'ids and enumerated labels written by the importer; the free text (title, failure_reason) is closed',
  },
  {
    table: 'public.import_batches',
    columns: ['source'],
    reason: 'import source name chosen from a fixed list',
  },
  {
    table: 'public.reviews',
    columns: ['content'],
    reason:
      'public review text, at most 280 characters; soft-deleted rows stay readable, follow-up',
  },
  {
    table: 'public.review_replies',
    columns: ['content'],
    reason: 'public reply text, at most 280 characters; soft-deleted rows stay readable, follow-up',
  },
  {
    table: 'public.journal_posts',
    columns: [
      'slug',
      'title',
      'body',
      'body_html',
      'excerpt',
      'featured_image_url',
      'context_id',
      'meta_title',
      'meta_description',
    ],
    reason: 'posts written by the owner and published on the site',
  },
];

export const ALLOWED_DEFINER_VIEWS: readonly AllowedTable[] = [];

export const ALLOWED_MATERIALIZED_VIEWS: readonly AllowedTable[] = [];

export const PRIVATE_TABLES: readonly string[] = [
  'public.refresh_tokens',
  'public.oauth_exchange_codes',
  'public.oauth_accounts',
];

export const CLOSED_COLUMNS: readonly { table: string; columns: readonly string[] }[] = [
  {
    table: 'public.users',
    columns: ['email', 'username', 'password_hash', 'avatar_url', 'bio', 'location', 'website'],
  },
  { table: 'public.user_media_state', columns: ['notes'] },
  { table: 'public.user_media_actions', columns: ['payload'] },
  { table: 'public.review_replies', columns: ['reply_to_username'] },
  { table: 'public.review_reports', columns: ['details', 'moderator_notes'] },
  { table: 'public.job_failure_days', columns: ['last_message'] },
  { table: 'public.key_health_checks', columns: ['detail'] },
  { table: 'public.catalog_evaluation_runs', columns: ['promoted_by', 'error_sample'] },
  { table: 'public.import_pending_items', columns: ['title', 'failure_reason'] },
];
