import type Redis from 'ioredis';
import { z } from 'zod';

import {
  FailureReason,
  RECORD_VERSION,
  RequestState,
} from '../../domain/constants/request.constants';
import type { InvestigationRecord } from '../../domain/entities/investigation-record';
import {
  CreateOutcome,
  FinishOutcome,
  type RequestStorePort,
} from '../../domain/ports/request-store.port';
import { RECORD_KEY_PREFIX, RECORD_TTL_SECONDS } from '../../investigation-requests.constants';

type RedisCommands = Pick<Redis, 'set' | 'get' | 'eval'>;

export class CorruptRecordError extends Error {
  constructor(readonly requestId: string) {
    super(`The stored request ${requestId} does not match the record schema`);
    this.name = 'CorruptRecordError';
  }
}

export const FINISH_SCRIPT = `
local current = redis.call('get', KEYS[1])
if current then
  local ok, decoded = pcall(cjson.decode, current)
  if ok and type(decoded) == 'table' and decoded.state == '${RequestState.ANSWERED}' then
    return 0
  end
end
redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
return 1
`;

export const TRANSITION_SCRIPT = `
local current = redis.call('get', KEYS[1])
if not current then
  return 0
end
local ok, decoded = pcall(cjson.decode, current)
if not ok or type(decoded) ~= 'table' then
  return 0
end
for index = 3, #ARGV do
  if decoded.state == ARGV[index] then
    redis.call('set', KEYS[1], ARGV[1], 'EX', ARGV[2])
    return 1
  end
end
return 0
`;

const enumOf = <T extends Record<string, string>>(values: T) =>
  z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]]);

const citationSchema = z.looseObject({
  path: z.string(),
  startLine: z.number(),
  endLine: z.number(),
});

const resultSchema = z.looseObject({
  repository: z.string(),
  ref: z.string(),
  commit: z.string(),
  turns: z.number(),
  costUsd: z.number(),
  answer: z.looseObject({
    answer: z.string(),
    facts: z.array(
      z.looseObject({
        text: z.string(),
        citations: z.array(citationSchema),
        evidence: z.array(
          z.looseObject({ ref: z.string(), tool: z.string(), summary: z.string() }),
        ),
      }),
    ),
    assumptions: z.array(
      z.looseObject({
        text: z.string(),
        origin: z.string(),
        problems: z.array(z.looseObject({ failure: z.string() })),
      }),
    ),
    unknowns: z.array(z.string()),
    support: z.string(),
  }),
});

const recordSchema = z.looseObject({
  version: z.literal(RECORD_VERSION),
  requestId: z.string(),
  question: z.string(),
  ref: z.string(),
  state: enumOf(RequestState),
  reason: enumOf(FailureReason).optional(),
  runId: z.string().optional(),
  createdAtMs: z.number(),
  startedAtMs: z.number().optional(),
  runStartedAtMs: z.number().optional(),
  finishedAtMs: z.number().optional(),
  result: resultSchema.optional(),
});

export class RedisRequestStore implements RequestStorePort {
  constructor(private readonly redis: RedisCommands) {}

  async create(record: InvestigationRecord): Promise<CreateOutcome> {
    const stored = await this.redis.set(
      this.keyFor(record.requestId),
      JSON.stringify(record),
      'EX',
      RECORD_TTL_SECONDS,
      'NX',
    );
    return stored === 'OK' ? CreateOutcome.CREATED : CreateOutcome.EXISTS;
  }

  async find(requestId: string): Promise<InvestigationRecord | null> {
    const raw = await this.redis.get(this.keyFor(requestId));
    if (raw === null) return null;
    const parsed = recordSchema.safeParse(this.decode(raw, requestId));
    if (!parsed.success) throw new CorruptRecordError(requestId);
    return parsed.data as unknown as InvestigationRecord;
  }

  async transition(record: InvestigationRecord, from: readonly RequestState[]): Promise<boolean> {
    const written = await this.redis.eval(
      TRANSITION_SCRIPT,
      1,
      this.keyFor(record.requestId),
      JSON.stringify(record),
      String(RECORD_TTL_SECONDS),
      ...from,
    );
    return written === 1;
  }

  async finish(record: InvestigationRecord): Promise<FinishOutcome> {
    const written = await this.redis.eval(
      FINISH_SCRIPT,
      1,
      this.keyFor(record.requestId),
      JSON.stringify(record),
      String(RECORD_TTL_SECONDS),
    );
    return written === 1 ? FinishOutcome.WRITTEN : FinishOutcome.KEPT_ANSWER;
  }

  private decode(raw: string, requestId: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      throw new CorruptRecordError(requestId);
    }
  }

  private keyFor(requestId: string): string {
    return `${RECORD_KEY_PREFIX}${requestId}`;
  }
}
