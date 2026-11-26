import { createStructuredLogger } from './create-structured-logger';
import { DEFAULT_LOG_LIMITS } from './log-limits';
import type { LoggerSettings } from './logger-settings';

const SETTINGS: LoggerSettings = {
  identity: { service: 'worker', environment: 'production' },
  format: 'json',
  minLevel: 'info',
  limits: DEFAULT_LOG_LIMITS,
  otlpEndpoint: 'http://alloy.railway.internal:4318',
};

describe('createStructuredLogger', () => {
  const realFetch = global.fetch;

  afterEach(() => {
    global.fetch = realFetch;
  });

  it('reports a failing export once a minute, not once per batch', async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 400 }));
    const lines: string[] = [];
    let nowMs = Date.parse('2026-11-26T10:00:00.000Z');
    const logger = createStructuredLogger(
      SETTINGS,
      { write: (line) => void lines.push(line) },
      () => new Date(nowMs),
    );

    logger.info('first');
    await logger.flush();
    logger.info('second');
    await logger.flush();
    nowMs += 61_000;
    logger.info('third');
    await logger.flush();

    const failures = lines.filter((line) => line.includes('Log records dropped'));
    expect(failures).toHaveLength(2);
    expect(JSON.parse(failures[0])).toMatchObject({
      level: 'warn',
      context: 'LogShipper',
      message: 'Log records dropped: HTTP 400',
      lost_records: 1,
    });
  });

  it('does not ship without an endpoint', async () => {
    global.fetch = jest.fn();
    const logger = createStructuredLogger(
      { ...SETTINGS, otlpEndpoint: undefined },
      { write: () => undefined },
    );

    logger.error('local only');
    await logger.flush();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
