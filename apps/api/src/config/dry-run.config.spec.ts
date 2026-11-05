import { DEFAULT_DRY_RUN_TIMEOUT_MS, resolveDryRunTimeoutMs } from './dry-run.config';

describe('dry-run.config / resolveDryRunTimeoutMs', () => {
  it('uses the default when the variable is not set', () => {
    expect(resolveDryRunTimeoutMs(undefined)).toBe(DEFAULT_DRY_RUN_TIMEOUT_MS);
    expect(resolveDryRunTimeoutMs('')).toBe(DEFAULT_DRY_RUN_TIMEOUT_MS);
  });

  it('accepts a positive integer number of milliseconds', () => {
    expect(resolveDryRunTimeoutMs('120000')).toBe(120000);
  });

  it.each(['60s', 'abc', '0', '-5', '1.5'])(
    'falls back to the default for an invalid value %p',
    (rawTimeoutMs) => {
      expect(resolveDryRunTimeoutMs(rawTimeoutMs)).toBe(DEFAULT_DRY_RUN_TIMEOUT_MS);
    },
  );
});
