export const METER_NAME = 'ratingo-storefront';
export const METRICS_EXPORT_INTERVAL_MS = 60_000;

export const NS_PER_SECOND = 1e9;
export const US_PER_SECOND = 1e6;

export const NEXT_SPAN_TYPE = {
  REQUEST: 'BaseServer.handleRequest',
  RENDER: 'AppRender.getBodyResult',
  FETCH: 'AppRender.fetch',
} as const;

export const REQUEST_DURATION_METRIC = 'app.next.request.duration';
export const RENDER_DURATION_METRIC = 'app.next.render.duration';
export const FETCH_DURATION_METRIC = 'app.next.fetch.duration';
export const REQUEST_ERRORS_METRIC = 'app.next.request.errors';

export const DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30,
];

export const UNMATCHED_ROUTE = 'unmatched';
export const UNKNOWN_HOST = 'unknown';
export const MISSING_LABEL = 'none';
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

export const EVENT_LOOP_DELAY_METRIC = 'app.process.event_loop.delay';
export const EVENT_LOOP_UTILIZATION_METRIC = 'app.process.event_loop.utilization';
export const EVENT_LOOP_RESOLUTION_MS = 20;
export const EVENT_LOOP_PERCENTILES = [50, 99] as const;
export const PROCESS_MEMORY_METRIC = 'app.process.memory';
export const PROCESS_CPU_TIME_METRIC = 'app.process.cpu.time';
