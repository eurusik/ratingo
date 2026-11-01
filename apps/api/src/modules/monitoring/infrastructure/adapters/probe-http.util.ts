import { HttpStatus } from '@nestjs/common';

import { type FetchResult, HttpError, type RetryConfig } from '@/common/http/resilient-http.client';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import { type KeyProbeResult } from '../../domain/ports/key-probe.port';

export const PROBE_TIMEOUT_MS = 8_000;

export const PROBE_RETRY_CONFIG: Partial<RetryConfig> = {
  maxRetries: 1,
  baseDelayMs: 500,
  maxTotalTimeMs: 10_000,
  timeoutMs: PROBE_TIMEOUT_MS,
};

export function mapHttpFailure(result: FetchResult<unknown>): KeyProbeResult {
  const { error } = result;
  const statusCode = error instanceof HttpError ? error.status : null;

  if (statusCode === HttpStatus.UNAUTHORIZED || statusCode === HttpStatus.FORBIDDEN) {
    return { status: API_KEY_STATUS.INVALID, statusCode, detail: 'Provider rejected the key' };
  }
  if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
    return { status: API_KEY_STATUS.DEGRADED, statusCode, detail: 'Rate limited (429)' };
  }
  return {
    status: API_KEY_STATUS.UNKNOWN,
    statusCode,
    detail: error?.message ?? 'Probe request failed',
  };
}
