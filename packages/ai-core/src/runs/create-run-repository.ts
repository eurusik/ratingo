import type { Meter } from '@opentelemetry/api';

import type { ClockPort } from '../clock/clock.port';
import { DurableSpendRunRepository } from './durable-spend.run-repository';
import { RedisSpendStore, type RedisSpendClient } from './redis.spend-store';
import type { RunLogger } from './run-logger.port';
import type { RunRepository } from './run.repository';
import type { SpendLogger } from './spend-store.port';
import { TelemetryRunRepository } from './telemetry.run-repository';

export interface DurableSpendOptions {
  redis: RedisSpendClient | null;
  keyPrefix: string;
  clock: ClockPort;
  logger: SpendLogger;
  processLocalWarning: string;
}

export interface RunRepositoryOptions {
  base: RunRepository;
  meter: Meter;
  runLogger: RunLogger;
  durableSpend?: DurableSpendOptions;
}

export const createRunRepository = (options: RunRepositoryOptions): RunRepository => {
  const { durableSpend } = options;
  let tracked = options.base;
  if (durableSpend !== undefined) {
    if (durableSpend.redis === null) {
      durableSpend.logger.warn(durableSpend.processLocalWarning);
    } else {
      tracked = new DurableSpendRunRepository(
        options.base,
        new RedisSpendStore(durableSpend.redis, durableSpend.keyPrefix),
        durableSpend.clock,
        durableSpend.logger,
      );
    }
  }
  return new TelemetryRunRepository(options.meter, options.runLogger, tracked);
};
