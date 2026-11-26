import fc from 'fast-check';

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

  it('keeps a whole record under the byte budget by trimming the stack first', () => {
    const error = new Error('x');
    error.stack = `Error: x\n${'    at frame (file.js:1:1)\n'.repeat(2_000)}`;

    const record = buildLogRecord(
      IDENTITY,
      { level: 'error', message: 'm'.repeat(50_000), error, fields: { note: 'n'.repeat(5_000) } },
      TIME,
      4_096,
    );

    expect(Buffer.byteLength(serializeLogRecord(record))).toBeLessThanOrEqual(4_096);
    expect(record.message.startsWith('mmmm')).toBe(true);
    expect((record.note as string).length).toBeLessThan(600);
  });

  it('keeps a record with many long fields under the budget and keeps its ids', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 3_000 }), { minLength: 0, maxLength: 40 }),
        fc.integer({ min: 0, max: 5_000 }),
        (values, messageLength) => {
          const fields = Object.fromEntries(
            values.map((value, index) => [`field_${index}`, value]),
          );
          const record = buildLogRecord(
            IDENTITY,
            {
              level: 'warn',
              message: 'm'.repeat(messageLength),
              fields: { ...fields, jobId: 'job-1', queue: 'ingestion', nested: { list: values } },
            },
            TIME,
            4_096,
          );
          return (
            Buffer.byteLength(serializeLogRecord(record)) <= 4_096 &&
            record.job_id === 'job-1' &&
            record.queue === 'ingestion'
          );
        },
      ),
    );
  });

  it('honours a smaller budget from the configuration', () => {
    const record = buildLogRecord(
      IDENTITY,
      { level: 'warn', message: 'm'.repeat(5_000) },
      TIME,
      1_024,
    );

    expect(Buffer.byteLength(serializeLogRecord(record))).toBeLessThanOrEqual(1_024);
  });

  it('never exceeds the budget for any message and field sizes', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20_000 }),
        fc.integer({ min: 0, max: 4_000 }),
        (messageLength, noteLength) => {
          const record = buildLogRecord(
            IDENTITY,
            {
              level: 'error',
              message: 'é'.repeat(messageLength),
              fields: { note: 'ж'.repeat(noteLength) },
              error: Object.assign(new Error('e'), { stack: 's'.repeat(messageLength) }),
            },
            TIME,
            4_096,
          );
          return Buffer.byteLength(serializeLogRecord(record)) <= 4_096;
        },
      ),
    );
  });
});
