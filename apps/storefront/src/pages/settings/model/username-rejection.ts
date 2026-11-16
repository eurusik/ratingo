import { ApiError, ErrorCode } from '@ratingo/web-core/api';

export type UsernameRejection = 'taken' | 'unavailable';

const USERNAME_FIELD_PREFIX = 'username ';

function validationMessages(error: ApiError): string[] {
  const { details } = error;
  if (typeof details !== 'object' || details === null || !('errors' in details)) return [];
  const { errors } = details;
  return Array.isArray(errors) ? errors.filter((message) => typeof message === 'string') : [];
}

export function usernameRejectionOf(error: unknown): UsernameRejection | null {
  if (!(error instanceof ApiError)) return null;
  if (error.code === ErrorCode.USERNAME_ALREADY_EXISTS) return 'taken';
  const isUsernameInvalid =
    error.code === ErrorCode.VALIDATION_ERROR &&
    validationMessages(error).some((message) => message.startsWith(USERNAME_FIELD_PREFIX));
  return isUsernameInvalid ? 'unavailable' : null;
}
