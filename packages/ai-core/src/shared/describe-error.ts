const UNKNOWN_ERROR_MESSAGE = 'unknown error';

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : UNKNOWN_ERROR_MESSAGE;
}
