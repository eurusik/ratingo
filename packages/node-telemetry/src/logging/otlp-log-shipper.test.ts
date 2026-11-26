import { buildLogRecord, type LogRecord } from './log-record';
import { buildOtlpLogsPayload, OtlpLogShipper } from './otlp-log-shipper';

const IDENTITY = { service: 'worker', environment: 'production' };

const record = (message: string, fields: Record<string, unknown> = {}): LogRecord =>
  buildLogRecord(
    IDENTITY,
    { level: 'warn', message, context: 'Sync', fields },
    new Date('2026-11-26T10:00:00.250Z'),
  );

const response = (status: number): Response => new Response(null, { status });

function setup(
  fetchImpl: jest.Mock,
  extra: Partial<ConstructorParameters<typeof OtlpLogShipper>[0]> = {},
) {
  const failures: [string, number][] = [];
  const shipper = new OtlpLogShipper({
    endpoint: 'http://alloy.railway.internal:4318/',
    identity: IDENTITY,
    fetchImpl,
    sleep: () => Promise.resolve(),
    retryDelaysMs: [1, 1],
    onFailure: (reason, lost) => void failures.push([reason, lost]),
    ...extra,
  });
  return { shipper, failures };
}

interface SentBody {
  resourceLogs: { scopeLogs: { logRecords: { body: { stringValue: string } }[] }[] }[];
}

const sentBodies = (fetchImpl: jest.Mock): SentBody[] =>
  (fetchImpl.mock.calls as [string, { body: string }][]).map(
    ([, init]) => JSON.parse(init.body) as SentBody,
  );

const sentMessages = (body: SentBody): string[] =>
  body.resourceLogs[0].scopeLogs[0].logRecords.map(
    (record) => (JSON.parse(record.body.stringValue) as { message: string }).message,
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

describe('OtlpLogShipper', () => {
  it('posts queued records to /v1/logs on flush', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper, failures } = setup(fetchImpl);

    shipper.enqueue(record('one'));
    shipper.enqueue(record('two'));
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls as [string][])[0][0]).toBe(
      'http://alloy.railway.internal:4318/v1/logs',
    );
    expect(sentBodies(fetchImpl)[0].resourceLogs[0].scopeLogs[0].logRecords).toHaveLength(2);
    expect(failures).toEqual([]);
  });

  it('splits large queues into batches', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl, { maxBatchSize: 2 });

    for (const name of ['a', 'b', 'c', 'd', 'e']) {
      shipper.enqueue(record(name));
    }
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('retries 503 and then succeeds without reporting a failure', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(503))
      .mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
      .mockResolvedValueOnce(response(200));
    const { shipper, failures } = setup(fetchImpl);

    shipper.enqueue(record('retry me'));
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(failures).toEqual([]);
  });

  it('gives up after the retry budget and reports the reason and the lost count', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(502));
    const { shipper, failures } = setup(fetchImpl);

    shipper.enqueue(record('a'));
    shipper.enqueue(record('b'));
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(failures).toEqual([['HTTP 502', 2]]);
  });

  it('does not retry a rejected payload', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(400));
    const { shipper, failures } = setup(fetchImpl);

    shipper.enqueue(record('bad'));
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(failures).toEqual([['HTTP 400', 1]]);
  });

  it('drops the oldest records when the queue overflows and says so', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper, failures } = setup(fetchImpl, { maxQueueSize: 2, maxBatchSize: 10 });

    for (const name of ['old', 'mid', 'new']) {
      shipper.enqueue(record(name));
    }
    await shipper.flush();

    const messages = sentMessages(sentBodies(fetchImpl)[0]);
    expect(messages).toEqual(['mid', 'new']);
    expect(failures).toEqual([['export queue overflow', 1]]);
  });

  it('sends on its own after the flush interval', async () => {
    jest.useFakeTimers();
    try {
      const fetchImpl = jest.fn().mockResolvedValue(response(200));
      const { shipper } = setup(fetchImpl, { flushIntervalMs: 500 });

      shipper.enqueue(record('timer'));
      await jest.advanceTimersByTimeAsync(600);

      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('flush with nothing queued sends nothing', async () => {
    const fetchImpl = jest.fn();
    const { shipper } = setup(fetchImpl);

    await shipper.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
