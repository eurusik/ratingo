export type AnalyticsMediaType = 'movie' | 'show';

export type HomeBlock =
  | 'home_hero'
  | 'home_top_picks'
  | 'home_top_ten'
  | 'home_episodes'
  | 'home_releases'
  | 'home_upcoming'
  | 'home_premieres';

export type SignInMethod = 'email' | 'google' | 'facebook';

export interface AnalyticsEvents {
  search: { results_count: number; filter: string };
  search_no_results: { search_term: string; filter: string };
  open_title: {
    origin: 'search' | HomeBlock;
    media_type: AnalyticsMediaType;
    in_catalog: boolean;
    position?: number;
    list?: string;
  };
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
    origin?: HomeBlock;
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
  episode_mark: { action: string; origin: 'sheet' | 'calendar' | 'library' };
  episode_reminder: { enabled: boolean };
  release_reminder: { enabled: boolean };
  premiere_reminder: { enabled: boolean };
  library_action: { action: string };
  browse_change: { category: string; change: 'filter' | 'sort' | 'pool' };
  calendar_change: {
    action: 'step' | 'this_week' | 'next_premiere' | 'mode' | 'type' | 'swipe';
    mode?: string;
    media_type?: AnalyticsMediaType;
  };
  home_rail_change: { section: string; list: string };
  calendar_open: { origin: 'home_upcoming' | 'home_episodes' | 'home_premieres' };
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
    origin?: string;
    items?: number;
  };
  notification_open: { type: string };
  undo: Record<string, never>;
  pwa_install: Record<string, never>;
  web_vitals: { metric_name: string; value: number; metric_id: string; metric_rating: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
