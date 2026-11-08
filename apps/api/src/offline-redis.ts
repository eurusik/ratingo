import { BullRegistrar, getQueueToken } from '@nestjs/bullmq';
import type { TestingModuleBuilder } from '@nestjs/testing';

import { HEALTH_QUEUE } from './health/health.constants';
import { COOLDOWN_REDIS_CLIENT } from './modules/catalog/public';
import { CATALOG_POLICY_QUEUE } from './modules/catalog-policy/public';
import {
  BACKFILL_QUEUE,
  INGESTION_QUEUE,
  RATINGS_BACKFILL_QUEUE,
} from './modules/ingestion/public';
import { MONITORING_QUEUE, MONITORING_REDIS_CLIENT } from './modules/monitoring/public';
import { STATS_QUEUE } from './modules/stats/public';

const APP_QUEUE_NAMES = [
  INGESTION_QUEUE,
  STATS_QUEUE,
  BACKFILL_QUEUE,
  RATINGS_BACKFILL_QUEUE,
  CATALOG_POLICY_QUEUE,
  HEALTH_QUEUE,
  MONITORING_QUEUE,
];

const APP_REDIS_CLIENTS = [COOLDOWN_REDIS_CLIENT, MONITORING_REDIS_CLIENT];

const NOOP_BULL_REGISTRAR = { onModuleInit: () => {}, register: () => {} };

const NOOP_REDIS_CLIENT = { quit: () => Promise.resolve('OK'), disconnect: () => {} };

export const replaceRedisWithStubs = (
  builder: TestingModuleBuilder,
  createQueueStub: (queueName: string) => object,
): TestingModuleBuilder => {
  const withoutWorkers = builder.overrideProvider(BullRegistrar).useValue(NOOP_BULL_REGISTRAR);
  const withoutClients = APP_REDIS_CLIENTS.reduce(
    (stubbed, token) => stubbed.overrideProvider(token).useValue(NOOP_REDIS_CLIENT),
    withoutWorkers,
  );
  return APP_QUEUE_NAMES.reduce(
    (stubbed, queueName) =>
      stubbed.overrideProvider(getQueueToken(queueName)).useValue(createQueueStub(queueName)),
    withoutClients,
  );
};
