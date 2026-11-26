import { z } from 'zod';

import {
  LOG_REQUEST_TIMEOUT_MS,
  LOG_RESPONSE_MAX_BYTES,
  LogsFailureClass,
} from '../../domain/constants/logs.constants';
import {
  LogsUnavailableError,
  type LogQuery,
  type LogsFetch,
  type LogsPort,
  type RawLogLine,
} from '../../domain/ports/logs.port';

const QUERY_RANGE_PATH = '/loki/api/v1/query_range';
const NANOS_PER_MS = 1_000_000n;
const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;
const HTTP_BAD_REQUEST = 400;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;
const TIMEOUT_ERROR_NAMES = new Set(['TimeoutError', 'AbortError']);

export interface LokiConnection {
  baseUrl: string;
  user: string;
  token: string;
}

const replySchema = z.object({
  status: z.literal('success'),
  data: z.object({
    resultType: z.literal('streams'),
    result: z.array(
      z.object({ values: z.array(z.tuple([z.string().regex(/^\d{1,25}$/), z.string()])) }),
    ),
  }),
});

const failureOfStatus = (status: number): LogsFailureClass => {
  if (status === HTTP_UNAUTHORIZED || status === HTTP_FORBIDDEN) {
    return LogsFailureClass.ACCESS_DENIED;
  }
  if (status === HTTP_TOO_MANY_REQUESTS) return LogsFailureClass.RATE_LIMIT;
  if (status === HTTP_BAD_REQUEST) return LogsFailureClass.BAD_QUERY;
  return status >= HTTP_SERVER_ERROR ? LogsFailureClass.SERVER_ERROR : LogsFailureClass.OTHER;
};

const failureOfTransport = (error: unknown): LogsFailureClass =>
  error instanceof Error && TIMEOUT_ERROR_NAMES.has(error.name)
    ? LogsFailureClass.TIMEOUT
    : LogsFailureClass.NETWORK;

const toNanos = (ms: number): string => (BigInt(Math.trunc(ms)) * NANOS_PER_MS).toString();

const toMs = (nanos: string): number => Number(BigInt(nanos) / NANOS_PER_MS);

const basicAuthorization = ({ user, token }: LokiConnection): string =>
  `Basic ${Buffer.from(`${user}:${token}`).toString('base64')}`;

const readCapped = async (response: Response, maxBytes: number): Promise<string> => {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new LogsUnavailableError(LogsFailureClass.TOO_LARGE);
  }
  const reader = response.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (reader === undefined) return '';
  const chunks: Uint8Array[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new LogsUnavailableError(LogsFailureClass.TOO_LARGE);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

const parsedReply = (body: string): z.infer<typeof replySchema> => {
  try {
    return replySchema.parse(JSON.parse(body));
  } catch {
    throw new LogsUnavailableError(LogsFailureClass.OTHER);
  }
};

const newestFirstLines = (reply: z.infer<typeof replySchema>): RawLogLine[] =>
  reply.data.result
    .flatMap((stream) => stream.values.map(([nanos, line]) => ({ atMs: toMs(nanos), line })))
    .sort((left, right) => right.atMs - left.atMs);

export class GrafanaLokiLogsAdapter implements LogsPort {
  constructor(
    private readonly connection: LokiConnection,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async search(query: LogQuery): Promise<LogsFetch> {
    const response = await this.fetchImpl(this.urlFor(query), {
      headers: { authorization: basicAuthorization(this.connection) },
      signal: AbortSignal.timeout(LOG_REQUEST_TIMEOUT_MS),
    }).catch((error: unknown) => {
      throw new LogsUnavailableError(failureOfTransport(error));
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new LogsUnavailableError(failureOfStatus(response.status));
    }
    const body = await readCapped(response, LOG_RESPONSE_MAX_BYTES).catch((error: unknown) => {
      throw error instanceof LogsUnavailableError
        ? error
        : new LogsUnavailableError(failureOfTransport(error));
    });
    const lines = newestFirstLines(parsedReply(body)).slice(0, query.limit);
    return { lines, limitReached: lines.length >= query.limit };
  }

  private urlFor(query: LogQuery): URL {
    const url = new URL(`${this.connection.baseUrl.replace(/\/+$/, '')}${QUERY_RANGE_PATH}`);
    url.searchParams.set('query', query.logql);
    url.searchParams.set('start', toNanos(query.startMs));
    url.searchParams.set('end', toNanos(query.endMs));
    url.searchParams.set('limit', String(query.limit));
    url.searchParams.set('direction', 'backward');
    return url;
  }
}
