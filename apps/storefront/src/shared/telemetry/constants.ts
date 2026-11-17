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
