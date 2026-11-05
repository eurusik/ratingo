import { registerAs } from '@nestjs/config';

export const DEFAULT_DRY_RUN_TIMEOUT_MS = 60_000;

export function resolveDryRunTimeoutMs(rawTimeoutMs: string | undefined): number {
  const timeoutMs = Number(rawTimeoutMs);
  return Number.isInteger(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_DRY_RUN_TIMEOUT_MS;
}

export default registerAs('dryRun', () => ({
  timeoutMs: resolveDryRunTimeoutMs(process.env.DRY_RUN_TIMEOUT_MS),
}));
