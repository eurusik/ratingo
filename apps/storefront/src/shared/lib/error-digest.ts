export function errorDigest(error: unknown): string | undefined {
  if (!(error instanceof Error) || !('digest' in error)) return undefined;
  return typeof error.digest === 'string' ? error.digest : undefined;
}
