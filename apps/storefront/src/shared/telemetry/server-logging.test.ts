import { metrics } from '@opentelemetry/api';
import { MeterProvider, MetricReader } from '@opentelemetry/sdk-metrics';
import {
  createStructuredLogger,
  DEFAULT_LOG_LIMITS,
  LOG_RECORDS_METRIC,
} from '@ratingo/node-telemetry';

import { captureConsole, startServerLogging } from './server-logging';

const SETTINGS = {
  identity: { service: 'ratingo-storefront', environment: 'production' },
  format: 'json',
  minLevel: 'info',
  limits: DEFAULT_LOG_LIMITS,
} as const;

function setup() {
  const lines: string[] = [];
  const logger = createStructuredLogger(SETTINGS, { write: (line) => void lines.push(line) });
  const target = {
    log: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  captureConsole(logger, target);
  const records = () => lines.map((line) => JSON.parse(line));
  return { target, lines, records };
}

describe('captureConsole', () => {
  it('turns console.error with an Error into one record holding the whole stack', () => {
    const { target, lines, records } = setup();
    const error = new Error('fetch failed');
    error.stack = 'Error: fetch failed\n    at load (page.js:1:1)\n    at render (page.js:2:2)';

    target.error('Sitemap: failed to load movies', error);

    expect(lines).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      level: 'error',
      service: 'ratingo-storefront',
      message: 'Sitemap: failed to load movies fetch failed',
      error_name: 'Error',
      error_message: 'fetch failed',
    });
    expect(records()[0].error_stack).toContain('at render (page.js:2:2)');
  });

  it('maps log, warn and debug onto info, warn and the level filter', () => {
    const { target, records } = setup();

    target.log('started');
    target.warn('slow');
    target.debug('hidden at info');

    expect(records().map((record) => [record.level, record.message])).toEqual([
      ['info', 'started'],
      ['warn', 'slow'],
    ]);
  });

  it('formats printf-style arguments like console does', () => {
    const { target, records } = setup();

    target.error('Upstream %s returned %d', 'api', 414);

    expect(records()[0].message).toBe('Upstream api returned 414');
  });

  it('redacts secrets that reach the console', () => {
    const { target, lines } = setup();

    target.error('callback failed', { headers: { authorization: 'Bearer abcdefghijklmnop1234' } });

    expect(lines[0]).not.toContain('abcdefghijklmnop1234');
  });
});

describe('startServerLogging', () => {
  it('leaves the console alone in pretty mode', () => {
    const before = console.error;

    expect(startServerLogging({ ...SETTINGS, format: 'pretty' })).toBeUndefined();
    expect(console.error).toBe(before);
  });
});

class CollectingReader extends MetricReader {
  protected onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  protected onForceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

describe('startServerLogging counters', () => {
  const originalConsole = { ...console };
  const originalFetch = global.fetch;

  beforeEach(() => {
    AbortSignal.timeout ??= () => new AbortController().signal;
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
    global.fetch = originalFetch;
  });

  it('counts shipped records even though logging starts before the meter provider', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, body: null });
    metrics.disable();
    const logger = startServerLogging({
      ...SETTINGS,
      otlpEndpoint: 'http://alloy.railway.internal:4318',
    });

    const reader = new CollectingReader();
    metrics.setGlobalMeterProvider(new MeterProvider({ readers: [reader] }));
    console.error('server render failed');
    await logger?.flush();

    const { resourceMetrics } = await reader.collect();
    const records = resourceMetrics.scopeMetrics
      .flatMap((scope) => scope.metrics)
      .find((metric) => metric.descriptor.name === LOG_RECORDS_METRIC);
    expect(records?.dataPoints.map((point) => point.attributes)).toEqual([
      { outcome: 'shipped', level: 'error' },
    ]);
  });
});
