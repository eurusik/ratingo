import {
  InMemoryRunRepository,
  createRunRepository as createAgentRunRepository,
  type ClockPort,
  type RedisSpendClient,
  type RunLogger,
  type RunRepository,
  type SpendLogger,
} from '@ratingo/ai-core';
import type { Meter } from '@opentelemetry/api';

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

export const createRunRepository = (deps: RunRepositoryDependencies): RunRepository =>
  createAgentRunRepository({
    base: new InMemoryRunRepository(),
    meter: deps.meter,
    runLogger: deps.runLogger,
    durableSpend: {
      redis: deps.redis,
      keyPrefix: SPEND_KEY_PREFIX,
      clock: deps.clock,
      logger: deps.spendLogger,
      processLocalWarning: PROCESS_LOCAL_BUDGET_WARNING,
    },
  });
