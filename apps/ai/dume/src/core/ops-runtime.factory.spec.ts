import { Logger } from '@nestjs/common';
import { FixedClock } from '@ratingo/ai-core';

import { envSchema } from '../config/env.schema';
import { createOpsRuntime } from './ops-runtime.factory';

const CLOCK = new FixedClock(1_000_000);

describe('createOpsRuntime', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('makes every tool report itself unavailable, with its reason, when nothing is configured', async () => {
    const { executors } = createOpsRuntime({ loki: {}, prometheus: {} }, CLOCK);

    await expect(executors.logsSearch({ service: 'ratingo-worker' })).rejects.toThrow(
      'logs_search is unavailable: not_configured',
    );
    await expect(executors.jobFailures({})).rejects.toThrow(
      'job_failures is unavailable: AI_READER_DATABASE_URL is not set',
    );
    await expect(executors.metricsQuery({ template: 'infra_health' })).rejects.toThrow(
      'Grafana не налаштована',
    );
    await expect(executors.dbSchema({})).rejects.toThrow(
      'db_schema is unavailable: AI_EXPLORER_DATABASE_URL is not set',
    );
    await expect(executors.dbQuery({ sql: 'SELECT 1' })).rejects.toThrow(
      'db_query is unavailable: AI_EXPLORER_DATABASE_URL is not set',
    );
  });

  it('says which Loki variables are missing when only some are set, and names no values', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    createOpsRuntime(
      { loki: { baseUrl: 'https://loki.example.invalid', user: '1' }, prometheus: {} },
      CLOCK,
    );

    expect(warn).toHaveBeenCalledWith('logs_search is off, missing: GRAFANA_LOKI_TOKEN');
  });

  it('stays quiet when no Loki variable is set at all', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);

    createOpsRuntime({ loki: {}, prometheus: {} }, CLOCK);

    expect(warn).not.toHaveBeenCalled();
  });

  it('closes without a database', async () => {
    await expect(
      createOpsRuntime({ loki: {}, prometheus: {} }, CLOCK).close(),
    ).resolves.toBeUndefined();
  });
});

describe('the runtime variables of the environment', () => {
  it('are all optional, and an empty value counts as not set', () => {
    const parsed = envSchema.parse({
      GRAFANA_LOKI_URL: '',
      GRAFANA_LOKI_USER: '',
      GRAFANA_LOKI_TOKEN: '',
      GRAFANA_PROM_URL: '',
      GRAFANA_PROM_TOKEN: '',
      AI_READER_DATABASE_URL: '',
      AI_EXPLORER_DATABASE_URL: '',
    });

    expect([
      parsed.GRAFANA_LOKI_URL,
      parsed.GRAFANA_LOKI_USER,
      parsed.GRAFANA_LOKI_TOKEN,
      parsed.GRAFANA_PROM_URL,
      parsed.GRAFANA_PROM_TOKEN,
      parsed.AI_READER_DATABASE_URL,
      parsed.AI_EXPLORER_DATABASE_URL,
    ]).toEqual([undefined, undefined, undefined, undefined, undefined, undefined, undefined]);
    expect(envSchema.safeParse({}).success).toBe(true);
  });

  it('rejects a URL that is not a URL', () => {
    expect(envSchema.safeParse({ GRAFANA_LOKI_URL: 'logs-prod' }).success).toBe(false);
    expect(envSchema.safeParse({ GRAFANA_PROM_URL: 'prom' }).success).toBe(false);
  });
});
