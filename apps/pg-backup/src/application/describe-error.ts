export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as Error & { code?: unknown }).code;
  return typeof code === 'string' && !error.message.includes(code)
    ? `${code} ${error.message}`
    : error.message;
}
