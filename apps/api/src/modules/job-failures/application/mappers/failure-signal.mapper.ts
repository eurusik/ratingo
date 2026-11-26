import { HttpException } from '@nestjs/common';

import { AppException } from '@/common/exceptions/app.exception';
import { ExternalApiException } from '@/common/exceptions/external-api.exception';
import { errorMessage } from '@/common/utils/error.utils';
import { type FailureSignal } from '@/modules/job-failures/domain/entities/failure-signal.entity';

const stringCodeOf = (value: unknown): string | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { code } = value as { code?: unknown };
  return typeof code === 'string' && code.length > 0 ? code : null;
};

const numericStatusOf = (value: unknown): number | null => {
  if (typeof value !== 'object' || value === null) return null;
  const { status } = value as { status?: unknown };
  return typeof status === 'number' ? status : null;
};

const causeOf = (error: unknown): unknown =>
  typeof error === 'object' && error !== null ? (error as { cause?: unknown }).cause : undefined;

const httpStatusOf = (error: unknown): number | null => {
  if (error instanceof ExternalApiException) return error.upstreamStatus ?? null;
  if (error instanceof HttpException) return error.getStatus();
  return numericStatusOf(error);
};

const errorCodeOf = (error: unknown): string | null => {
  const ownCode = error instanceof AppException ? null : stringCodeOf(error);
  return ownCode ?? stringCodeOf(causeOf(error));
};

const errorNameOf = (error: unknown): string =>
  error instanceof Error ? error.name : typeof error;

export const toFailureSignal = (error: unknown): FailureSignal => ({
  errorName: errorNameOf(error),
  httpStatus: httpStatusOf(error),
  errorCode: errorCodeOf(error),
  message: errorMessage(error),
});
