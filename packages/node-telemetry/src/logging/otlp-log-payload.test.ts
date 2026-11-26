import { buildLogRecord, type LogRecord } from './log-record';
import { buildOtlpLogsPayload } from './otlp-log-payload';

const IDENTITY = { service: 'worker', environment: 'production' };

const record = (message: string, fields: Record<string, unknown> = {}): LogRecord =>
  buildLogRecord(
    IDENTITY,
    { level: 'warn', message, context: 'Sync', fields },
    new Date('2026-11-26T10:00:00.250Z'),
  );

describe('buildOtlpLogsPayload', () => {
  it('puts the JSON line in the body and ids in attributes, with only resource labels', () => {
    const payload = buildOtlpLogsPayload(IDENTITY, [
      record('slow', { jobId: 'j1', queue: 'stats' }),
    ]);

    const [resourceLogs] = payload.resourceLogs;
    const [logRecord] = resourceLogs.scopeLogs[0].logRecords;
    expect(resourceLogs.resource.attributes).toEqual([
      { key: 'service.name', value: { stringValue: 'worker' } },
      { key: 'deployment.environment.name', value: { stringValue: 'production' } },
    ]);
    expect(logRecord).toMatchObject({
      severityNumber: 13,
      severityText: 'warn',
      timeUnixNano: '1795687200250000000',
    });
    expect(JSON.parse(logRecord.body.stringValue)).toMatchObject({ message: 'slow', job_id: 'j1' });
    expect(logRecord.attributes).toEqual(
      expect.arrayContaining([
        { key: 'context', value: { stringValue: 'Sync' } },
        { key: 'job_id', value: { stringValue: 'j1' } },
        { key: 'queue', value: { stringValue: 'stats' } },
      ]),
    );
  });
});
