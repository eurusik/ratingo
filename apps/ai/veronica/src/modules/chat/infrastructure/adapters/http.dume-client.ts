import { z } from 'zod';

import type { DumeConfig } from '../../../../config/config.constants';
import { DUME_REQUEST_TIMEOUT_MS } from '../../domain/constants/dume.constants';
import {
  DumeFailureReason,
  DumeRejectionReason,
  DumeState,
  DumeSubmitKind,
  DumeSupport,
  type DumeLookup,
  type DumeRequestView,
  type DumeSubmission,
  type DumeSubmitResult,
} from '../../domain/entities/dume';
import {
  DumeUnavailableError,
  StartCertainty,
  type DumeClientPort,
} from '../../domain/ports/dume-client.port';

const INTERNAL_PATH = '/internal/investigations';
const HTTP_CONFLICT = 409;
const HTTP_TOO_MANY_REQUESTS = 429;
const HTTP_SERVER_ERROR = 500;

const knownOr = <T extends Record<string, string>>(
  values: T,
  value: string,
  fallback: T[keyof T],
): T[keyof T] => (Object.values(values).includes(value) ? (value as T[keyof T]) : fallback);

const citationSchema = z.object({
  path: z.string(),
  startLine: z.number().int(),
  endLine: z.number().int(),
});

const resultSchema = z.object({
  repository: z.string(),
  ref: z.string(),
  commit: z.string(),
  turns: z.number(),
  costUsd: z.number(),
  answer: z.object({
    answer: z.string(),
    facts: z.array(
      z.object({
        text: z.string(),
        citations: z.array(citationSchema),
        evidence: z.array(z.object({ ref: z.string(), tool: z.string(), summary: z.string() })),
      }),
    ),
    assumptions: z.array(
      z.object({
        text: z.string(),
        origin: z.string(),
        problems: z.array(z.object({ failure: z.string() })),
      }),
    ),
    unknowns: z.array(z.string()),
    support: z.string(),
  }),
});

const requestSchema = z.object({
  requestId: z.string(),
  state: z.string(),
  reason: z.string().optional(),
  createdAtMs: z.number(),
  startedAtMs: z.number().optional(),
  finishedAtMs: z.number().optional(),
  result: resultSchema.optional(),
});

const acceptedSchema = z.object({
  status: z.literal('accepted'),
  created: z.boolean(),
  request: requestSchema,
});

const rejectedSchema = z.object({ status: z.literal('rejected'), reason: z.string() });

const lookupSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('found'), request: requestSchema }),
]);

const toView = (raw: z.infer<typeof requestSchema>): DumeRequestView => ({
  ...raw,
  state: knownOr(DumeState, raw.state, DumeState.RUNNING),
  reason:
    raw.reason === undefined
      ? undefined
      : knownOr(DumeFailureReason, raw.reason, DumeFailureReason.INTERNAL_ERROR),
  result:
    raw.result === undefined
      ? undefined
      : {
          ...raw.result,
          answer: {
            ...raw.result.answer,
            support: knownOr(DumeSupport, raw.result.answer.support, DumeSupport.UNSUPPORTED),
          },
        },
});

interface RawResponse {
  status: number;
  body: unknown;
}

const maybeStarted = (reason: string): DumeUnavailableError =>
  new DumeUnavailableError(reason, StartCertainty.MAYBE_STARTED);

export class HttpDumeClient implements DumeClientPort {
  constructor(
    private readonly config: DumeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async submit(submission: DumeSubmission): Promise<DumeSubmitResult> {
    const { status, body } = await this.call('POST', INTERNAL_PATH, submission);
    if (status === HTTP_CONFLICT) return { kind: DumeSubmitKind.CONFLICT };
    if (status === HTTP_TOO_MANY_REQUESTS) {
      const rejected = rejectedSchema.safeParse(body);
      if (!rejected.success) throw maybeStarted('unexpected response shape');
      return {
        kind: DumeSubmitKind.REJECTED,
        reason: knownOr(DumeRejectionReason, rejected.data.reason, DumeRejectionReason.OTHER),
      };
    }
    if (status >= HTTP_SERVER_ERROR) throw maybeStarted(`HTTP ${status}`);
    if (status < 200 || status >= 300) throw new DumeUnavailableError(`HTTP ${status}`);
    const accepted = acceptedSchema.safeParse(body);
    if (!accepted.success) throw maybeStarted('unexpected response shape');
    return {
      kind: DumeSubmitKind.ACCEPTED,
      created: accepted.data.created,
      request: toView(accepted.data.request),
    };
  }

  async find(requestId: string): Promise<DumeLookup> {
    const { status, body } = await this.call('GET', `${INTERNAL_PATH}/${requestId}`);
    if (status < 200 || status >= 300) throw new DumeUnavailableError(`HTTP ${status}`);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) throw new DumeUnavailableError('unexpected response shape');
    return parsed.data.status === 'not_found'
      ? { kind: 'not_found' }
      : { kind: 'found', request: toView(parsed.data.request) };
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    payload?: DumeSubmission,
  ): Promise<RawResponse> {
    const { internalUrl, serviceToken } = this.config;
    if (internalUrl === undefined || serviceToken === undefined) {
      throw new DumeUnavailableError('not_configured');
    }
    const base = internalUrl.replace(/\/+$/, '');
    let response: Response;
    try {
      response = await this.fetchImpl(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${serviceToken}`,
          accept: 'application/json',
          ...(payload === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
        signal: AbortSignal.timeout(DUME_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw maybeStarted(error instanceof Error ? error.name : 'network_error');
    }
    try {
      return { status: response.status, body: await response.json() };
    } catch {
      if (response.status >= HTTP_SERVER_ERROR || response.ok) {
        throw maybeStarted(`HTTP ${response.status} without JSON`);
      }
      throw new DumeUnavailableError(`HTTP ${response.status} without JSON`);
    }
  }
}
