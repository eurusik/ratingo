import { LogsFailureClass } from '../../domain/constants/logs.constants';
import { LogsUnavailableError, type LogQuery } from '../../domain/ports/logs.port';

import { GrafanaLokiLogsAdapter } from './grafana-loki.logs-adapter';

const CONNECTION = {
  baseUrl: 'https://logs.example.invalid/',
  user: '12345',
  token: 'glc_fake_token',
};
const START_MS = Date.UTC(2026, 10, 25, 12, 0, 0);
const END_MS = Date.UTC(2026, 10, 26, 12, 0, 0);
const QUERY: LogQuery = {
  logql:
    '{service_name=`ratingo-worker`,deployment_environment_name=`production`} | detected_level=`error`',
  startMs: START_MS,
  endMs: END_MS,
  limit: 3,
};

const nanos = (ms: number): string => `${ms}000000`;

const streamsReply = (...streams: [string, string][][]) => ({
  status: 'success',
  data: {
    resultType: 'streams',
    result: streams.map((values) => ({ stream: { service_name: 'ratingo-worker' }, values })),
  },
});

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const adapterWith = (handler: (url: URL, init: RequestInit) => Response | Promise<Response>) => {
  const calls: { url: URL; init: RequestInit }[] = [];
  const fetchImpl = (async (url: URL, init: RequestInit) => {
    calls.push({ url, init });
    return handler(url, init);
  }) as unknown as typeof fetch;
  return { calls, adapter: new GrafanaLokiLogsAdapter(CONNECTION, fetchImpl) };
};

const failureOf = async (promise: Promise<unknown>): Promise<LogsUnavailableError> => {
  const error: unknown = await promise.then(
    () => {
      throw new Error('expected the search to fail');
    },
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(LogsUnavailableError);
  return error as LogsUnavailableError;
};

describe('GrafanaLokiLogsAdapter', () => {
  it('asks the query_range endpoint once with basic auth, nanosecond times, limit and newest first', async () => {
    const { adapter, calls } = adapterWith(() => json(streamsReply([])));

    await adapter.search(QUERY);

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0];
    expect(`${url.origin}${url.pathname}`).toBe(
      'https://logs.example.invalid/loki/api/v1/query_range',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      query: QUERY.logql,
      start: nanos(START_MS),
      end: nanos(END_MS),
      limit: '3',
      direction: 'backward',
    });
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from('12345:glc_fake_token').toString('base64')}`,
    );
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('merges streams into lines, newest first, with millisecond times', async () => {
    const { adapter } = adapterWith(() =>
      json(
        streamsReply(
          [[nanos(START_MS + 1000), 'a']],
          [
            [nanos(START_MS + 3000), 'c'],
            [nanos(START_MS + 2000), 'b'],
          ],
        ),
      ),
    );

    const result = await adapter.search({ ...QUERY, limit: 10 });

    expect(result).toEqual({
      lines: [
        { atMs: START_MS + 3000, line: 'c' },
        { atMs: START_MS + 2000, line: 'b' },
        { atMs: START_MS + 1000, line: 'a' },
      ],
      limitReached: false,
    });
  });

  it('reports the limit as reached when it got that many lines', async () => {
    const { adapter } = adapterWith(() =>
      json(
        streamsReply(
          [1, 2, 3, 4].map(
            (offset) => [nanos(START_MS + offset), String(offset)] as [string, string],
          ),
        ),
      ),
    );

    const result = await adapter.search(QUERY);

    expect(result.lines.map((line) => line.line)).toEqual(['4', '3', '2']);
    expect(result.limitReached).toBe(true);
  });

  it.each([
    [401, LogsFailureClass.ACCESS_DENIED],
    [403, LogsFailureClass.ACCESS_DENIED],
    [429, LogsFailureClass.RATE_LIMIT],
    [400, LogsFailureClass.BAD_QUERY],
    [502, LogsFailureClass.SERVER_ERROR],
    [404, LogsFailureClass.OTHER],
  ])('turns HTTP %i into %s and says nothing else', async (status, reason) => {
    const { adapter } = adapterWith(() => json({ message: 'detail with glc_fake_token' }, status));

    const error = await failureOf(adapter.search(QUERY));

    expect(error.reason).toBe(reason);
    expect(error.message).toBe(`logs_search is unavailable: ${reason}`);
  });

  it('classifies a timeout and a network failure', async () => {
    const timeout = adapterWith(() => {
      throw Object.assign(new Error('boom'), { name: 'TimeoutError' });
    });
    const network = adapterWith(() => {
      throw new TypeError('fetch failed: https://logs.example.invalid glc_fake_token');
    });

    expect((await failureOf(timeout.adapter.search(QUERY))).reason).toBe(LogsFailureClass.TIMEOUT);
    const networkError = await failureOf(network.adapter.search(QUERY));
    expect(networkError.reason).toBe(LogsFailureClass.NETWORK);
    expect(networkError.message).not.toContain('glc_');
  });

  it.each([
    ['not json', new Response('<html>', { status: 200 })],
    ['a metric result', json({ status: 'success', data: { resultType: 'matrix', result: [] } })],
    ['a failed status', json({ status: 'error', data: { resultType: 'streams', result: [] } })],
    ['a bad timestamp', json(streamsReply([['yesterday', 'x']]))],
  ])('refuses a reply that is %s', async (_label, reply) => {
    const { adapter } = adapterWith(() => reply);
    expect((await failureOf(adapter.search(QUERY))).reason).toBe(LogsFailureClass.OTHER);
  });

  it('refuses a body that declares more than the byte cap', async () => {
    const { adapter } = adapterWith(
      () => new Response('{}', { status: 200, headers: { 'content-length': '9999999' } }),
    );
    expect((await failureOf(adapter.search(QUERY))).reason).toBe(LogsFailureClass.TOO_LARGE);
  });

  it('stops reading a body that grows past the byte cap without declaring it', async () => {
    const chunk = new Uint8Array(1_000_000);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1;
        controller.enqueue(chunk);
        if (sent > 50) controller.close();
      },
    });
    const { adapter } = adapterWith(() => new Response(body, { status: 200 }));

    expect((await failureOf(adapter.search(QUERY))).reason).toBe(LogsFailureClass.TOO_LARGE);
    expect(sent).toBeLessThan(10);
  });
});
