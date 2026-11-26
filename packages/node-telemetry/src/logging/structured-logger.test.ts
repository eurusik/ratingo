import { StructuredLogger } from './structured-logger';
import type { LogShipper } from './log-shipper';

const IDENTITY = { service: 'veronica', environment: 'production' };

function setup(minLevel: 'debug' | 'info' | 'warn' | 'error') {
  const lines: string[] = [];
  const shipped: unknown[] = [];
  const shipper: LogShipper = {
    enqueue: (record) => void shipped.push(record),
    flush: () => Promise.resolve(),
  };
  const logger = new StructuredLogger({
    identity: IDENTITY,
    minLevel,
    sink: { write: (line) => void lines.push(line) },
    shipper,
    now: () => new Date('2026-11-26T10:00:00.000Z'),
  });
  return { logger, lines, shipped };
}

describe('StructuredLogger level rules', () => {
  it.each([
    ['debug', 4],
    ['info', 3],
    ['warn', 2],
    ['error', 1],
  ] as const)('with min level %s writes %i of the 4 levels', (minLevel, expected) => {
    const { logger, lines } = setup(minLevel);

    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');

    expect(lines).toHaveLength(expected);
  });

  it('writes exactly one newline-terminated JSON line per record', () => {
    const { logger, lines } = setup('info');

    logger.info('hello', { fields: { runId: 'r1' } });

    expect(lines).toHaveLength(1);
    expect(lines[0].endsWith('\n')).toBe(true);
    expect(JSON.parse(lines[0])).toMatchObject({
      level: 'info',
      service: 'veronica',
      run_id: 'r1',
    });
  });

  it('ships only what it writes', () => {
    const { logger, shipped } = setup('warn');

    logger.info('skipped');
    logger.error('kept');

    expect(shipped).toHaveLength(1);
  });
});

describe('StructuredLogger flush', () => {
  const identity = { service: 'worker', environment: 'production' };

  it('gives up waiting for a shipper that never answers', async () => {
    const logger = new StructuredLogger({
      identity,
      minLevel: 'info',
      sink: { write: () => undefined },
      shipper: { enqueue: () => undefined, flush: () => new Promise<void>(() => undefined) },
      flushTimeoutMs: 20,
    });

    await expect(logger.flush()).resolves.toBeUndefined();
  });

  it('resolves at once without a shipper', async () => {
    const logger = new StructuredLogger({
      identity,
      minLevel: 'info',
      sink: { write: () => undefined },
    });

    await expect(logger.flush()).resolves.toBeUndefined();
  });
});
