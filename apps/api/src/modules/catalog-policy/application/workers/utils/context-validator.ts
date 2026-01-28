/**
 * Context Validator Utility
 *
 * Validates that job payloads contain required context field.
 */

import { Logger } from '@nestjs/common';

import { type EvaluationContextType } from '../../../domain/constants/evaluation.constants';

interface PayloadWithContext {
  context?: EvaluationContextType;
}

interface JobInfo {
  runId?: string;
  policyVersion?: number;
  mediaItemId?: string;
}

/**
 * Validates that context is present in payload.
 * Missing context is a bug - fail fast.
 *
 * @param payload - Job payload that should contain context
 * @param jobInfo - Additional job info for logging
 * @param logger - Logger instance
 * @returns true if context is present, false otherwise
 */
export function validateContextPayload(
  payload: PayloadWithContext,
  jobInfo: JobInfo,
  logger: Logger,
): payload is { context: EvaluationContextType } {
  if (!payload.context) {
    logger.error('MISSING_CONTEXT_IN_JOB_PAYLOAD - this is a bug, not a runtime issue', {
      ...jobInfo,
      message: 'Job payload missing required context field',
    });
    return false;
  }
  return true;
}
