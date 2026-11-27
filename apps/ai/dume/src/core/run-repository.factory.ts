import type { Meter } from '@opentelemetry/api';
import {
  DurableSpendRunRepository,
  InMemoryRunRepository,
  RedisSpendStore,
  TelemetryRunRepository,
  type ClockPort,
  type RedisSpendClient,
  type RunLogger,
  type RunRepository,
  type SpendLogger,
} from '@ratingo/ai-core';

const SPEND_KEY_PREFIX = 'ai:dume';

const PROCESS_LOCAL_BUDGET_WARNING =
  'REDIS_URL is not set: the daily budget is counted per process and resets on restart';

export interface RunRepositoryDependencies {
  meter: Meter;
  clock: ClockPort;
  runLogger: RunLogger;
  spendLogger: SpendLogger;
  redis: RedisSpendClient | null;
}

export const createRunRepository = (deps: RunRepositoryDependencies): RunRepository => {
  const inMemory = new InMemoryRunRepository();
  if (deps.redis === null) {
    deps.spendLogger.warn(PROCESS_LOCAL_BUDGET_WARNING);
  }
  const spendTracked =
    deps.redis === null
      ? inMemory
      : new DurableSpendRunRepository(
          inMemory,
          new RedisSpendStore(deps.redis, SPEND_KEY_PREFIX),
          deps.clock,
          deps.spendLogger,
        );
  return new TelemetryRunRepository(deps.meter, deps.runLogger, spendTracked);
};
