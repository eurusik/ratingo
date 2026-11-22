export const METER_NAME = 'ratingo-storefront';

export const NEXT_SPAN_TYPE = {
  REQUEST: 'BaseServer.handleRequest',
  RENDER: 'AppRender.getBodyResult',
  FETCH: 'AppRender.fetch',
} as const;

export const REQUEST_DURATION_METRIC = 'app.next.request.duration';
export const RENDER_DURATION_METRIC = 'app.next.render.duration';
export const FETCH_DURATION_METRIC = 'app.next.fetch.duration';
export const REQUEST_ERRORS_METRIC = 'app.next.request.errors';

export const UNKNOWN_HOST = 'unknown';
export const MISSING_LABEL = 'none';
export const FETCH_CACHE_STATUS = { SKIP: 'skip', MISS: 'miss' } as const;
export const COLD_CACHE_ENTRY_REASON = 'hard refresh';
export const FAILED_FETCH_STATUS = 0;
export const OTHER_METHOD = '_OTHER';
export const KNOWN_HTTP_METHODS: ReadonlySet<string> = new Set([
  'GET',
  'HEAD',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
]);

export const TRACE_ID_PREFIX_HEX_LENGTH = 8;
export const TRACE_ID_PREFIX_RANGE = 0x1_0000_0000;

export const CLIENT_KIND = {
  HUMAN: 'human',
  BOT: 'bot',
  AI_CRAWLER: 'ai_crawler',
} as const;

export type ClientKind = (typeof CLIENT_KIND)[keyof typeof CLIENT_KIND];

export const CLIENT_KIND_SPAN_ATTRIBUTE = 'ratingo.client_kind';
export const CLIENT_KIND_LABEL = 'client_kind';
export const USER_AGENT_HEADER = 'user-agent';
export const USER_AGENT_MAX_LENGTH = 512;

export const AI_CRAWLER_USER_AGENT_MARKERS: readonly string[] = [
  'gptbot',
  'chatgpt-user',
  'oai-searchbot',
  'claudebot',
  'claude-web',
  'claude-user',
  'claude-searchbot',
  'anthropic-ai',
  'perplexitybot',
  'perplexity-user',
  'google-extended',
  'ccbot',
  'bytespider',
  'applebot-extended',
  'amazonbot',
  'meta-externalagent',
  'meta-externalfetcher',
  'cohere-ai',
  'diffbot',
  'youbot',
];

export const BOT_USER_AGENT_MARKERS: readonly string[] = [
  'googlebot',
  'bingbot',
  'yandexbot',
  'duckduckbot',
  'baiduspider',
  'ahrefsbot',
  'semrushbot',
  'mj12bot',
  'facebookexternalhit',
  'twitterbot',
  'telegrambot',
  'slackbot',
  'whatsapp',
  'discordbot',
  'curl/',
  'wget/',
  'python-requests',
  'go-http-client',
  'headlesschrome',
];

export const GENERIC_BOT_USER_AGENT_PATTERN = /bot|crawler|spider/;
