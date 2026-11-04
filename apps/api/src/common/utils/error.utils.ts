export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null) {
    const { message } = error as { message?: unknown };
    return typeof message === 'string' && message ? message : Object.prototype.toString.call(error);
  }
  return String(error as string | number | boolean | bigint | symbol | null | undefined);
}

export function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(errorMessage(error));
}
