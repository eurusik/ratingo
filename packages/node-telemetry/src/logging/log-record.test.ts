import { runWithLogContext } from './log-context';
import { buildLogRecord, serializeLogRecord } from './log-record';

const IDENTITY = { service: 'api', environment: 'production' };
const TIME = new Date('2026-11-26T10:00:00.123Z');

describe('buildLogRecord', () => {
  it('emits time, level, service, environment, context and message', () => {
    const record = buildLogRecord(
      IDENTITY,
      { level: 'info', message: 'Worker is running', context: 'Worker' },
      TIME,
    );

    expect(record).toEqual({
      time: '2026-11-26T10:00:00.123Z',
      level: 'info',
      service: 'api',
      environment: 'production',
      context: 'Worker',
      message: 'Worker is running',
    });
  });

  it('keeps the whole stack in one field and splits name and message', () => {
    const error = new TypeError('db down');

    const line = serializeLogRecord(
      buildLogRecord(IDENTITY, { level: 'error', message: 'Sync failed', error }, TIME),
    );
    const parsed = JSON.parse(line) as Record<string, string>;

    expect(line).not.toContain('\n');
    expect(parsed.error_name).toBe('TypeError');
    expect(parsed.error_message).toBe('db down');
    expect(parsed.error_stack).toContain('\n    at ');
  });

  it('snake-cases caller fields and drops undefined ones', () => {
    const record = buildLogRecord(
      IDENTITY,
      { level: 'info', message: 'done', fields: { runId: 'r1', inputTokens: 12, task: undefined } },
      TIME,
    );

    expect(record).toMatchObject({ run_id: 'r1', input_tokens: 12 });
    expect(record).not.toHaveProperty('task');
  });

  it('adds correlation ids from the async log context', () => {
    const record = runWithLogContext({ job_id: 'j-1', queue: 'ingestion' }, () =>
      buildLogRecord(IDENTITY, { level: 'warn', message: 'slow' }, TIME),
    );

    expect(record).toMatchObject({ job_id: 'j-1', queue: 'ingestion' });
  });

  it('lets explicit fields override the context but never the reserved keys', () => {
    const record = runWithLogContext({ queue: 'a' }, () =>
      buildLogRecord(
        IDENTITY,
        { level: 'info', message: 'x', fields: { queue: 'b', level: 'error', service: 'evil' } },
        TIME,
      ),
    );

    expect(record).toMatchObject({ queue: 'b', level: 'info', service: 'api' });
  });

  it('redacts secrets in messages, fields and error text', () => {
    const record = buildLogRecord(
      IDENTITY,
      {
        level: 'error',
        message: 'login for jane@example.com failed',
        error: new Error('Bearer abcdefghijklmnop1234 rejected'),
        fields: { authorization: 'Bearer zzzzzzzzzzzzzzzz', status: 401 },
      },
      TIME,
    );
    const line = serializeLogRecord(record);

    expect(line).not.toContain('jane@example.com');
    expect(line).not.toContain('abcdefghijklmnop1234');
    expect(line).not.toContain('zzzzzzzzzzzzzzzz');
    expect(record).toMatchObject({ status: 401 });
  });

  it('truncates oversized messages and stacks', () => {
    const error = new Error('x');
    error.stack = `Error: x\n${'    at frame (file.js:1:1)\n'.repeat(2_000)}`;

    const record = buildLogRecord(
      IDENTITY,
      { level: 'error', message: 'm'.repeat(50_000), error },
      TIME,
    );

    expect((record.message as string).length).toBeLessThan(8_100);
    expect((record.error_stack as string).length).toBeLessThan(16_100);
  });
});
