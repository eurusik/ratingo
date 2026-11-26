import { runWithLogContext } from './log-context';
import { NestCompatibleLogger } from './nest-compatible-logger';
import { StructuredLogger } from './structured-logger';

const JOB_PREFIX = /^\[job:([^\]]+)\]\s*/;

function setup(parseMessage?: ConstructorParameters<typeof NestCompatibleLogger>[1]) {
  const lines: string[] = [];
  const logger = new NestCompatibleLogger(
    new StructuredLogger({
      identity: { service: 'api', environment: 'production' },
      minLevel: 'debug',
      sink: { write: (line) => void lines.push(line) },
      now: () => new Date('2026-11-26T10:00:00.000Z'),
    }),
    parseMessage,
  );
  const records = () => lines.map((line) => JSON.parse(line) as Record<string, unknown>);
  return { logger, lines, records };
}

describe('NestCompatibleLogger', () => {
  it('treats the last string argument as the context when there are several', () => {
    const { logger, records } = setup();

    logger.log('Worker is running', 'Worker');

    expect(records()).toEqual([
      expect.objectContaining({ level: 'info', context: 'Worker', message: 'Worker is running' }),
    ]);
  });

  it('treats a single string as the message', () => {
    const { logger, records } = setup();

    logger.warn('only a message');

    expect(records()[0]).toMatchObject({ level: 'warn', message: 'only a message' });
    expect(records()[0]).not.toHaveProperty('context');
  });

  it('maps verbose and fatal onto debug and error', () => {
    const { logger, records } = setup();

    logger.verbose('v', 'Ctx');
    logger.fatal('f', 'Ctx');

    expect(records().map((record) => record.level)).toEqual(['debug', 'error']);
  });

  it('keeps a stack passed as the second argument inside one error record', () => {
    const { logger, lines, records } = setup();
    const stack = 'Error: boom\n    at a (a.js:1:1)\n    at b (b.js:2:2)';

    logger.error('Failed: boom', stack, 'RatingsBackfillWorker');

    expect(lines).toHaveLength(1);
    expect(records()[0]).toMatchObject({
      level: 'error',
      context: 'RatingsBackfillWorker',
      message: 'Failed: boom',
      error_message: 'Failed: boom',
    });
    expect(records()[0].error_stack).toContain('at b (b.js:2:2)');
  });

  it('treats a second string that is not a stack as the context', () => {
    const { logger, records } = setup();

    logger.error('plain failure', 'Ctx');

    expect(records()[0]).toMatchObject({ context: 'Ctx', message: 'plain failure' });
    expect(records()[0]).not.toHaveProperty('error_stack');
  });

  it('unwraps Error instances', () => {
    const { logger, records } = setup();

    logger.error(new RangeError('db down'));

    expect(records()[0]).toMatchObject({
      message: 'db down',
      error_name: 'RangeError',
      error_message: 'db down',
    });
  });

  it('turns an object with a message into fields in snake case', () => {
    const { logger, records } = setup();

    logger.log({ message: 'ai.run.finished', runId: 'r1', inputTokens: 5 }, 'Run');

    expect(records()[0]).toMatchObject({
      message: 'ai.run.finished',
      run_id: 'r1',
      input_tokens: 5,
      context: 'Run',
    });
  });

  it('moves a [job:id] prefix out of the message with a parser', () => {
    const { logger, records } = setup((text) => {
      const match = JOB_PREFIX.exec(text);
      return match
        ? { text: text.replace(JOB_PREFIX, ''), fields: { job_id: match[1] } }
        : { text };
    });

    logger.error('[job:backfill_8f3_20261126] Failed: timeout', undefined, 'BackfillWorker');

    expect(records()[0]).toMatchObject({
      message: 'Failed: timeout',
      job_id: 'backfill_8f3_20261126',
    });
  });

  it('demotes the per-provider and per-route startup lines to debug', () => {
    const { logger, records } = setup();

    logger.log('ConfigModule dependencies initialized', 'InstanceLoader');
    logger.log('Mapped {/api/health, GET} route', 'RouterExplorer');
    logger.log('Nest application successfully started', 'NestApplication');

    expect(records().map((record) => [record.context, record.level])).toEqual([
      ['InstanceLoader', 'debug'],
      ['RouterExplorer', 'debug'],
      ['NestApplication', 'info'],
    ]);
  });

  it('keeps warnings from framework contexts', () => {
    const { logger, records } = setup();

    logger.warn('Circular dependency detected', 'InstanceLoader');

    expect(records()[0]).toMatchObject({ level: 'warn' });
  });

  it('adds async context ids to every record inside the scope', () => {
    const { logger, records } = setup();

    runWithLogContext({ request_id: 'req-9' }, () => logger.log('inside', 'Http'));
    logger.log('outside', 'Http');

    expect(records()[0]).toMatchObject({ request_id: 'req-9' });
    expect(records()[1]).not.toHaveProperty('request_id');
  });
});
