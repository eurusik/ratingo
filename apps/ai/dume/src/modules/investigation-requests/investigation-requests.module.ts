import { Inject, Logger, Module, type OnApplicationShutdown } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import {
  REDIS_CONFIG,
  SERVICE_CONFIG,
  type RedisConfig,
  type ServiceConfig,
} from '../../config/config.constants';
import { AGENT_FOLDER } from '../../core/ai-core.constants';
import { InvestigationModule } from '../investigation/public';

import { InvestigationLookupService } from './application/services/investigation-lookup.service';
import { RunInvestigationService } from './application/services/run-investigation.service';
import { SubmitInvestigationService } from './application/services/submit-investigation.service';
import { InvestigationWorker } from './application/workers/investigation.worker';
import { DAY_LIMITS } from './domain/ports/day-limits.port';
import { INVESTIGATION_QUEUE } from './domain/ports/investigation-queue.port';
import { REQUEST_STORE } from './domain/ports/request-store.port';
import { AgentDayLimits } from './infrastructure/adapters/agent-day-limits.adapter';
import { BullmqInvestigationQueue } from './infrastructure/queue/bullmq-investigation-queue';
import { RedisRequestStore } from './infrastructure/stores/redis.request-store';
import {
  INVESTIGATION_QUEUE_NAME,
  INVESTIGATION_QUEUE_PREFIX,
  QUEUE_REDIS,
  REDIS_COMMAND_TIMEOUT_MS,
  STATE_REDIS,
} from './investigation-requests.constants';
import { InternalInvestigationController } from './presentation/controllers/internal-investigation.controller';
import { InternalApiGuard } from './presentation/guards/internal-api.guard';

const redisLogger = new Logger('DumeRedis');

const logRedisError = (connection: string) => (error: Error) =>
  redisLogger.warn({ message: 'redis.error', connection, reason: error.name });

const requireRedisUrl = (config: RedisConfig): string => {
  if (config.url === undefined) throw new Error('REDIS_URL is required by the service');
  return config.url;
};

@Module({
  imports: [InvestigationModule],
  controllers: [InternalInvestigationController],
  providers: [
    InternalApiGuard,
    SubmitInvestigationService,
    InvestigationLookupService,
    RunInvestigationService,
    InvestigationWorker,
    {
      provide: STATE_REDIS,
      inject: [REDIS_CONFIG],
      useFactory: (config: RedisConfig) =>
        new Redis(requireRedisUrl(config), {
          commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
          maxRetriesPerRequest: 1,
        }).on('error', logRedisError('state')),
    },
    {
      provide: QUEUE_REDIS,
      inject: [REDIS_CONFIG],
      useFactory: (config: RedisConfig) =>
        new Redis(requireRedisUrl(config), { maxRetriesPerRequest: null }).on(
          'error',
          logRedisError('queue'),
        ),
    },
    {
      provide: REQUEST_STORE,
      inject: [STATE_REDIS],
      useFactory: (redis: Redis) => new RedisRequestStore(redis),
    },
    {
      provide: INVESTIGATION_QUEUE,
      inject: [QUEUE_REDIS],
      useFactory: (redis: Redis) =>
        new BullmqInvestigationQueue(
          new Queue(INVESTIGATION_QUEUE_NAME, {
            connection: redis.duplicate(),
            prefix: INVESTIGATION_QUEUE_PREFIX,
          }),
        ),
    },
    {
      provide: DAY_LIMITS,
      inject: [STATE_REDIS, RUN_REPOSITORY, AGENT_FOLDER, CLOCK_PORT, SERVICE_CONFIG],
      useFactory: (
        redis: Redis,
        runs: RunRepository,
        folder: AgentFolder,
        clock: ClockPort,
        service: ServiceConfig,
      ) =>
        new AgentDayLimits({
          redis,
          runs,
          folder,
          clock,
          maxPerDay: service.maxInvestigationsPerDay,
        }),
    },
  ],
})
export class InvestigationRequestsModule implements OnApplicationShutdown {
  constructor(
    @Inject(STATE_REDIS) private readonly stateRedis: Redis,
    @Inject(QUEUE_REDIS) private readonly queueRedis: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled([
      this.stateRedis.quit().catch(() => this.stateRedis.disconnect()),
      this.queueRedis.quit().catch(() => this.queueRedis.disconnect()),
    ]);
  }
}
