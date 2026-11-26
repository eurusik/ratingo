import { gunzipSync } from 'node:zlib';

import { buildLogRecord, type LogRecord } from './log-record';
import type { LogOutcome, LogStats } from './log-stats';
import { buildOtlpLogsPayload } from './otlp-log-payload';
import { OtlpLogShipper } from './otlp-log-shipper';

const IDENTITY = { service: 'worker', environment: 'production' };
const LIMITS = { dedupeWindowMs: 60_000, maxRecordsPerMinute: 1_000, maxBytesPerDay: 10_000_000 };

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
    limits: LIMITS,
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
  (fetchImpl.mock.calls as [string, { body: Buffer }][]).map(
    ([, init]) => JSON.parse(gunzipSync(init.body).toString('utf8')) as SentBody,
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
    const { shipper, failures } = setup(fetchImpl, {
      maxQueueBytes: 2 * Buffer.byteLength(JSON.stringify(record('old'))) + 10,
      maxBatchSize: 10,
    });

    for (const name of ['old', 'mid', 'new']) {
      shipper.enqueue(record(name));
    }
    await shipper.flush();

    const messages = sentMessages(sentBodies(fetchImpl)[0]);
    expect(messages).toEqual(['mid', 'new']);
    expect(failures).toEqual([['queue overflow', 1]]);
  });

  it('sends on its own after the flush interval', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl, { flushIntervalMs: 20 });

    shipper.enqueue(record('timer'));
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('compresses every request with gzip', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl);

    shipper.enqueue(record('squeeze me'));
    await shipper.flush();

    const [, init] = fetchImpl.mock.calls[0] as [
      string,
      { headers: Record<string, string>; body: Buffer },
    ];
    expect(init.headers['content-encoding']).toBe('gzip');
    expect(init.body.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));
  });

  it('flush with nothing queued sends nothing', async () => {
    const fetchImpl = jest.fn();
    const { shipper } = setup(fetchImpl);

    await shipper.flush();

    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

function statsRecorder() {
  const counts: Record<string, number> = {};
  const stats: LogStats = {
    record: (outcome: LogOutcome) => {
      counts[outcome] = (counts[outcome] ?? 0) + 1;
    },
  };
  return { stats, counts };
}

describe('OtlpLogShipper cost controls', () => {
  it('reports a repeat count on its own when the window ends, without new traffic', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl, {
      limits: { ...LIMITS, dedupeWindowMs: 60 },
      flushIntervalMs: 10,
    });

    shipper.enqueue(record('Provider timed out for item 1'));
    shipper.enqueue(record('Provider timed out for item 2'));
    shipper.enqueue(record('Provider timed out for item 3'));
    await new Promise((resolve) => setTimeout(resolve, 400));

    const lines = sentBodies(fetchImpl).flatMap((body) =>
      body.resourceLogs[0].scopeLogs[0].logRecords.map(
        (item) => JSON.parse(item.body.stringValue) as { repeats?: number },
      ),
    );
    expect(lines.map((line) => line.repeats)).toEqual([undefined, 2]);
  });

  it('does not resend a delivered batch when releasing the response body fails', async () => {
    const cancel = jest.fn().mockRejectedValue(new Error('stream locked'));
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, status: 200, body: { cancel } });
    const { shipper, failures } = setup(fetchImpl);

    shipper.enqueue(record('delivered once'));
    await shipper.flush();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(failures).toEqual([]);
  });

  it('releases the response body on success and on failure so connections can be reused', async () => {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 400, body: { cancel } })
      .mockResolvedValueOnce({ ok: true, status: 200, body: { cancel } });
    const { shipper } = setup(fetchImpl);

    shipper.enqueue(record('first'));
    await shipper.flush();
    shipper.enqueue(record('second'));
    await shipper.flush();

    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('collapses identical warnings inside the window and ships one summary with the count', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { stats, counts } = statsRecorder();
    let nowMs = Date.parse('2026-11-26T10:00:00.000Z');
    const { shipper } = setup(fetchImpl, { stats, now: () => nowMs });

    for (let id = 1; id <= 50; id += 1) {
      shipper.enqueue(record(`Failed to get Trakt data for TMDB ${id}: timeout`));
    }
    nowMs += 61_000;
    shipper.enqueue(record('something else'));
    await shipper.flush();

    const messages = sentBodies(fetchImpl).flatMap((body) => sentMessages(body));
    expect(messages).toHaveLength(3);
    expect(messages[0]).toBe('Failed to get Trakt data for TMDB 1: timeout');
    expect(counts.collapsed).toBe(49);
    const summary = JSON.parse(
      sentBodies(fetchImpl)[0].resourceLogs[0].scopeLogs[0].logRecords[1].body.stringValue,
    ) as { repeats: number };
    expect(summary.repeats).toBe(49);
  });

  it('ships the repeat summary even when the minute is already full', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl, {
      limits: { ...LIMITS, maxRecordsPerMinute: 2 },
      now: () => Date.parse('2026-11-26T10:00:00.000Z'),
    });

    shipper.enqueue(record('Trakt data failed for TMDB 1'));
    shipper.enqueue(record('Trakt data failed for TMDB 2'));
    shipper.enqueue(record('Trakt data failed for TMDB 3'));
    await shipper.flush();

    const lines = sentBodies(fetchImpl)[0].resourceLogs[0].scopeLogs[0].logRecords.map(
      (item) => JSON.parse(item.body.stringValue) as { repeats?: number },
    );
    expect(lines.map((line) => line.repeats)).toEqual([undefined, 2]);
  });

  it('never collapses info records', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl);
    const info = (message: string) => ({ ...record(message), level: 'info' as const });

    shipper.enqueue(info('same'));
    shipper.enqueue(info('same'));
    await shipper.flush();

    expect(sentMessages(sentBodies(fetchImpl)[0])).toEqual(['same', 'same']);
  });

  it('stops shipping past the per-minute rate and keeps room for errors', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { stats, counts } = statsRecorder();
    const { shipper, failures } = setup(fetchImpl, {
      stats,
      limits: { ...LIMITS, maxRecordsPerMinute: 3 },
      now: () => Date.parse('2026-11-26T10:00:00.000Z'),
    });
    const info = (n: number) => ({ ...record(`info ${n}`), level: 'info' as const });
    const error = (n: number) => ({ ...record(`error ${n}`), level: 'error' as const });

    for (let n = 1; n <= 6; n += 1) {
      shipper.enqueue(info(n));
    }
    shipper.enqueue(error(1));
    await shipper.flush();

    const messages = sentMessages(sentBodies(fetchImpl)[0]);
    expect(messages).toEqual(['info 1', 'info 2', 'info 3', 'error 1']);
    expect(counts.dropped_rate_limit).toBe(3);
    expect(failures).toEqual([['rate limit', 3]]);
  });

  it('keeps shipping errors after the daily budget for other levels is used up', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { shipper } = setup(fetchImpl, {
      limits: { ...LIMITS, maxBytesPerDay: 2_000 },
      now: () => Date.parse('2026-11-26T10:00:00.000Z'),
    });
    const sample = record('x'.repeat(100));

    for (let n = 0; n < 20; n += 1) {
      shipper.enqueue({ ...sample, level: 'info' });
    }
    shipper.enqueue({ ...sample, level: 'error', message: 'still ships' });
    await shipper.flush();

    const messages = sentBodies(fetchImpl).flatMap((body) => sentMessages(body));
    expect(messages.filter((message) => message === 'still ships')).toHaveLength(1);
    expect(messages.length).toBeLessThan(21);
  });

  it('starts a new day with a fresh budget', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    let nowMs = Date.parse('2026-11-26T23:59:00.000Z');
    const { shipper } = setup(fetchImpl, {
      limits: { ...LIMITS, maxBytesPerDay: 500 },
      now: () => nowMs,
    });
    const info = (message: string) => ({ ...record(message), level: 'info' as const });

    for (let n = 0; n < 5; n += 1) {
      shipper.enqueue(info(`late ${n}`));
    }
    nowMs = Date.parse('2026-11-27T00:01:00.000Z');
    shipper.enqueue(info('next day'));
    await shipper.flush();

    const messages = sentBodies(fetchImpl).flatMap((body) => sentMessages(body));
    expect(messages).toContain('next day');
  });

  it('counts shipped records and bytes per level through the stats port', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(200));
    const { stats, counts } = statsRecorder();
    const { shipper } = setup(fetchImpl, { stats });

    shipper.enqueue(record('one'));
    shipper.enqueue(record('two'));
    await shipper.flush();

    expect(counts.shipped).toBe(2);
  });

  it('counts records lost to a failing export', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(response(500));
    const { stats, counts } = statsRecorder();
    const { shipper } = setup(fetchImpl, { stats });

    shipper.enqueue(record('lost'));
    await shipper.flush();

    expect(counts.dropped_export_failed).toBe(1);
  });

  it('keeps the queue under its byte bound while the endpoint is unreachable', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const { shipper } = setup(fetchImpl, {
      maxQueueBytes: 5_000,
      maxBatchSize: 1_000,
      retryDelaysMs: [],
    });

    for (let n = 0; n < 2_000; n += 1) {
      shipper.enqueue({ ...record(`entry ${n} ${'p'.repeat(100)}`), level: 'info' });
    }
    await shipper.flush();

    const sent = sentBodies(jest.fn());
    expect(sent).toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
