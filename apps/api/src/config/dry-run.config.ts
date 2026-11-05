import { registerAs } from '@nestjs/config';

const DEFAULT_DRY_RUN_TIMEOUT_MS = 60_000;

export default registerAs('dryRun', () => {
  const configuredTimeoutMs = process.env.DRY_RUN_TIMEOUT_MS;
  return {
    timeoutMs: configuredTimeoutMs ? parseInt(configuredTimeoutMs, 10) : DEFAULT_DRY_RUN_TIMEOUT_MS,
  };
});
