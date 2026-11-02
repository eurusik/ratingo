import { ConsoleLogger, Logger } from '@nestjs/common';

import { JsonConsoleLogger } from './json-console.logger';

describe('JsonConsoleLogger', () => {
  let stdout: jest.SpyInstance;
  let stderr: jest.SpyInstance;

  const entries = (spy: jest.SpyInstance): Record<string, unknown>[] =>
    spy.mock.calls.map(([line]) => JSON.parse(String(line)));

  beforeEach(() => {
    stdout = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('writes one JSON line per log call with level, context and message', () => {
    new JsonConsoleLogger().log('Worker is running', 'Worker');

    expect(entries(stdout)).toEqual([
      expect.objectContaining({ level: 'info', context: 'Worker', message: 'Worker is running' }),
    ]);
    expect(Date.parse(String(entries(stdout)[0].time))).not.toBeNaN();
  });

  it('keeps the stack trace inside the error entry instead of separate lines', () => {
    const stack = 'Error: boom\n    at a (a.js:1:1)\n    at b (b.js:2:2)';

    new JsonConsoleLogger().error('[job:1] Failed: boom', stack, 'RatingsBackfillWorker');

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(entries(stderr)).toEqual([
      expect.objectContaining({
        level: 'error',
        context: 'RatingsBackfillWorker',
        message: '[job:1] Failed: boom',
        stack,
      }),
    ]);
  });

  it('writes an error without a stack as a single entry', () => {
    new JsonConsoleLogger().error('plain failure', 'Ctx');

    expect(entries(stderr)).toEqual([
      expect.objectContaining({ level: 'error', context: 'Ctx', message: 'plain failure' }),
    ]);
    expect(entries(stderr)[0]).not.toHaveProperty('stack');
  });

  it('unwraps Error instances into message and stack', () => {
    const error = new Error('db down');

    new JsonConsoleLogger().error(error);

    expect(entries(stderr)).toEqual([
      expect.objectContaining({ message: 'db down', stack: error.stack }),
    ]);
  });

  it('folds an Error passed after the message into the same entry', () => {
    const error = new Error('connection refused');

    new JsonConsoleLogger().error('Sync failed', error, 'TraktSyncService');

    expect(stderr).toHaveBeenCalledTimes(1);
    expect(entries(stderr)).toEqual([
      expect.objectContaining({
        context: 'TraktSyncService',
        message: 'Sync failed: connection refused',
        stack: error.stack,
      }),
    ]);
  });

  it('writes several error messages with one stack as a single entry', () => {
    const stack = 'Error: boom\n    at a (a.js:1:1)';

    new JsonConsoleLogger().error('first', 'second', stack, 'Ctx');

    expect(entries(stderr)).toEqual([
      expect.objectContaining({ context: 'Ctx', message: 'first: second', stack }),
    ]);
  });

  it('writes fatal to stdout with error severity', () => {
    new JsonConsoleLogger().fatal('shutting down', 'Ctx');

    expect(stderr).not.toHaveBeenCalled();
    expect(entries(stdout)).toEqual([
      expect.objectContaining({ level: 'error', message: 'shutting down' }),
    ]);
  });

  it('serialises non-string messages without colour codes', () => {
    new JsonConsoleLogger().warn({ jobId: 7, nested: { ok: false } }, 'Ctx');

    const [entry] = entries(stdout);
    expect(entry).toMatchObject({ level: 'warn', context: 'Ctx' });
    expect(entry.message).toContain('jobId: 7');
    expect(entry.message).not.toContain(String.fromCharCode(27));
  });

  it.each([
    ['debug', 'debug'],
    ['verbose', 'debug'],
    ['fatal', 'error'],
  ] as const)('maps Nest level %s to severity %s', (method, severity) => {
    const logger = new JsonConsoleLogger();
    logger.setLogLevels(['verbose', 'debug', 'fatal']);

    logger[method]('message', 'Ctx');

    expect(entries(stdout)[0]).toMatchObject({ level: severity });
  });

  it('respects configured log levels', () => {
    const logger = new JsonConsoleLogger();
    logger.setLogLevels(['log', 'warn', 'error', 'fatal']);

    logger.debug('hidden', 'Ctx');
    logger.verbose('hidden', 'Ctx');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });

  it('formats messages from Nest Logger instances once overridden', () => {
    Logger.overrideLogger(new JsonConsoleLogger());
    try {
      new Logger('CatalogService').warn('slow query');
    } finally {
      Logger.overrideLogger(new ConsoleLogger());
    }

    expect(entries(stdout)).toEqual([
      expect.objectContaining({ level: 'warn', context: 'CatalogService', message: 'slow query' }),
    ]);
  });
});
