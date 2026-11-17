export type AnalyticsMediaType = 'movie' | 'show';

export type SignInMethod = 'email' | 'google' | 'facebook';

export interface AnalyticsEvents {
  search: { results_count: number; filter: string };
  search_no_results: { search_term: string; filter: string };
  open_title: { source: string; media_type: AnalyticsMediaType; in_catalog: boolean };
  title_import: {
    media_type: AnalyticsMediaType;
    result: 'ready' | 'not_found' | 'failed' | 'timeout' | 'unreachable';
  };
  auth_prompt: { intent: string };
  sign_up: { method: SignInMethod };
  login: { method: SignInMethod };
  logout: Record<string, never>;
  save_to_library: {
    action: 'save' | 'remove' | 'restore';
    list: string;
    media_type?: AnalyticsMediaType;
  };
  rate_title: { rating: number | null; media_type?: AnalyticsMediaType };
  review_publish: {
    is_edit: boolean;
    has_spoiler: boolean;
    has_text: boolean;
    rating: number | null;
    media_type?: AnalyticsMediaType;
  };
  review_interaction: { action: 'vote' | 'reply' | 'report' | 'delete' };
  episode_mark: { action: string; source: 'sheet' | 'calendar' | 'library' };
  episode_reminder: { enabled: boolean };
  library_action: { action: string };
  browse_change: { category: string; change: 'filter' | 'sort' | 'pool' };
  calendar_change: { action: 'step' | 'this_week' | 'mode' | 'swipe'; mode?: string };
  share: { result: 'shared' | 'copied' | 'cancelled' | 'failed' };
  app_error: {
    kind: 'mutation' | 'query' | 'render' | 'not_found';
    area: string;
    status?: number;
    code?: string;
  };
  login_failed: { method: SignInMethod; reason: string; mode?: 'login' | 'sign_up' };
  onboarding: { step: 'shown' | 'start_show' | 'want_movie' | 'search' | 'import' };
  library_import: {
    stage: 'start' | 'success' | 'failed';
    source?: string;
    items?: number;
  };
  notification_open: { type: string };
  undo: Record<string, never>;
  pwa_install: Record<string, never>;
  web_vitals: { metric_name: string; value: number; metric_id: string; metric_rating: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
