import { z } from 'zod';

import type { HappyConfig } from '../../../../config/config.constants';
import { HAPPY_REQUEST_TIMEOUT_MS } from '../../domain/constants/happy.constants';
import {
  HappyLookupKind,
  HappyRequestKind,
  HappyResultStatus,
  HappySeverity,
  type HappyLookup,
  type HappyOpenPullRequest,
  type HappyReviewRequest,
} from '../../domain/entities/happy';
import { HappyUnavailableError, type HappyClientPort } from '../../domain/ports/happy-client.port';

const INTERNAL_PATH = '/internal/pull-requests';

const count = z.number().int().min(0);

const resultSchema = z.object({
  status: z.enum(Object.values(HappyResultStatus) as [HappyResultStatus, ...HappyResultStatus[]]),
  checkedSha: z.string(),
  current: z.boolean(),
  title: z.string(),
  summary: z.string(),
  skipReason: z.string().nullable(),
  counts: z.object({
    [HappySeverity.CRITICAL]: count,
    [HappySeverity.MAJOR]: count,
    [HappySeverity.MINOR]: count,
    [HappySeverity.NIT]: count,
  }),
  questions: z.array(z.object({ file: z.string(), line: z.number(), text: z.string() })),
  coverage: z.object({
    complete: z.boolean(),
    unreviewedFiles: count,
    gaps: z.array(z.string()),
  }),
  checkRunUrl: z.string().nullable(),
});

const lookupSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_found') }),
  z.object({
    status: z.literal('found'),
    headSha: z.string(),
    reviewPending: z.boolean(),
    result: resultSchema.nullable(),
  }),
]);

const requestSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.enum([
      HappyRequestKind.QUEUED,
      HappyRequestKind.ALREADY_RUNNING,
      HappyRequestKind.ALREADY_REVIEWED,
    ]),
    headSha: z.string(),
  }),
  z.object({ status: z.literal(HappyRequestKind.SKIPPED), reason: z.string() }),
  z.object({ status: z.literal(HappyRequestKind.NOT_FOUND) }),
]);

const openListSchema = z.object({
  status: z.literal('ok'),
  pullRequests: z.array(
    z.object({
      number: z.number().int(),
      title: z.string(),
      author: z.string(),
      updatedAt: z.string(),
    }),
  ),
});

export class HttpHappyClient implements HappyClientPort {
  constructor(
    private readonly config: HappyConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async requestReview(pullNumber: number): Promise<HappyReviewRequest> {
    const body = await this.call('POST', `${INTERNAL_PATH}/${pullNumber}/review`);
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new HappyUnavailableError('unexpected response shape');
    const { status, ...rest } = parsed.data;
    return { kind: status, ...rest } as HappyReviewRequest;
  }

  async latestResult(pullNumber: number): Promise<HappyLookup> {
    const body = await this.call('GET', `${INTERNAL_PATH}/${pullNumber}/review`);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) throw new HappyUnavailableError('unexpected response shape');
    return parsed.data.status === 'not_found'
      ? { kind: HappyLookupKind.NOT_FOUND }
      : {
          kind: HappyLookupKind.FOUND,
          headSha: parsed.data.headSha,
          reviewPending: parsed.data.reviewPending,
          result: parsed.data.result,
        };
  }

  async listOpenPullRequests(): Promise<HappyOpenPullRequest[]> {
    const parsed = openListSchema.safeParse(await this.call('GET', INTERNAL_PATH));
    if (!parsed.success) throw new HappyUnavailableError('unexpected response shape');
    return parsed.data.pullRequests.map((pull) => ({
      number: pull.number,
      title: pull.title,
      author: pull.author,
      updatedAtMs: Date.parse(pull.updatedAt),
    }));
  }

  private async call(method: 'GET' | 'POST', path: string): Promise<unknown> {
    const { internalUrl, serviceToken } = this.config;
    if (internalUrl === undefined || serviceToken === undefined) {
      throw new HappyUnavailableError('HAPPY_INTERNAL_URL or HAPPY_SERVICE_TOKEN is not set');
    }
    const base = internalUrl.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await this.fetchImpl(`${base}${path}`, {
        method,
        headers: { authorization: `Bearer ${serviceToken}`, accept: 'application/json' },
        signal: AbortSignal.timeout(HAPPY_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new HappyUnavailableError(error instanceof Error ? error.name : 'network error');
    }
    if (!response.ok) throw new HappyUnavailableError(`HTTP ${response.status}`);
    try {
      return await response.json();
    } catch {
      throw new HappyUnavailableError('response is not JSON');
    }
  }
}
