import { formatterFor } from './log-format';
import { buildLogRecord } from './log-record';

const record = buildLogRecord(
  { service: 'api', environment: 'development' },
  {
    level: 'error',
    message: 'Sync failed',
    context: 'SyncWorker',
    error: Object.assign(new Error('boom'), { stack: 'Error: boom\n    at a (a.js:1:1)' }),
    fields: { jobId: 'j1' },
  },
  new Date('2026-11-26T10:11:12.345Z'),
);

describe('formatterFor', () => {
  it('json: one parseable line ending in a newline', () => {
    const line = formatterFor('json')(record);

    expect(line.endsWith('\n')).toBe(true);
    expect(line.trimEnd().split('\n')).toHaveLength(1);
    expect(JSON.parse(line)).toMatchObject({ level: 'error', job_id: 'j1' });
  });

  it('pretty: readable, without ANSI colour codes', () => {
    const line = formatterFor('pretty')(record);

    expect(line).toContain('10:11:12.345 ERROR [SyncWorker] Sync failed job_id="j1"');
    expect(line).toContain('at a (a.js:1:1)');
    expect(line).not.toContain('\u001b[');
  });
});
