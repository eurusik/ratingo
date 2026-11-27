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
  type DumeSubmission,
  type DumeSubmitResult,
} from '../../domain/entities/dume';
import { DumeUnavailableError, type DumeClientPort } from '../../domain/ports/dume-client.port';

const INTERNAL_PATH = '/internal/investigations';

const enumOf = <T extends Record<string, string>>(values: T) =>
  z.enum(Object.values(values) as [T[keyof T], ...T[keyof T][]]);

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
    support: enumOf(DumeSupport),
  }),
});

const requestSchema = z.object({
  requestId: z.string(),
  state: enumOf(DumeState),
  reason: enumOf(DumeFailureReason).optional(),
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

const rejectedSchema = z.object({
  status: z.literal('rejected'),
  reason: enumOf(DumeRejectionReason),
});

const lookupSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('not_found') }),
  z.object({ status: z.literal('found'), request: requestSchema }),
]);

interface RawResponse {
  status: number;
  body: unknown;
}

export class HttpDumeClient implements DumeClientPort {
  constructor(
    private readonly config: DumeConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async submit(submission: DumeSubmission): Promise<DumeSubmitResult> {
    const { status, body } = await this.call('POST', INTERNAL_PATH, submission);
    if (status === 409) return { kind: DumeSubmitKind.CONFLICT };
    if (status === 429) {
      const rejected = rejectedSchema.safeParse(body);
      if (!rejected.success) throw new DumeUnavailableError('unexpected response shape');
      return { kind: DumeSubmitKind.REJECTED, reason: rejected.data.reason };
    }
    if (status < 200 || status >= 300) throw new DumeUnavailableError(`HTTP ${status}`);
    const accepted = acceptedSchema.safeParse(body);
    if (!accepted.success) throw new DumeUnavailableError('unexpected response shape');
    return {
      kind: DumeSubmitKind.ACCEPTED,
      created: accepted.data.created,
      request: accepted.data.request,
    };
  }

  async find(requestId: string): Promise<DumeLookup> {
    const { status, body } = await this.call('GET', `${INTERNAL_PATH}/${requestId}`);
    if (status < 200 || status >= 300) throw new DumeUnavailableError(`HTTP ${status}`);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) throw new DumeUnavailableError('unexpected response shape');
    return parsed.data.status === 'not_found'
      ? { kind: 'not_found' }
      : { kind: 'found', request: parsed.data.request };
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
      throw new DumeUnavailableError(error instanceof Error ? error.name : 'network_error');
    }
    try {
      return { status: response.status, body: await response.json() };
    } catch {
      throw new DumeUnavailableError(`HTTP ${response.status} without JSON`);
    }
  }
}
