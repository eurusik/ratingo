import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';

import IORedis from 'ioredis';

import { apiOnly, workerOnly } from '@/common/runtime/app-role';
import mdblistConfig from '@/config/mdblist.config';
import omdbConfig from '@/config/omdb.config';
import schedulerConfig from '@/config/scheduler.config';
import tmdbConfig from '@/config/tmdb.config';
import traktConfig from '@/config/trakt.config';

import { ExternalApiFailureListener } from './application/listeners/external-api-failure.listener';
import { KeyHealthService } from './application/services/key-health.service';
import { MonitoringSchedulerService } from './application/services/monitoring-scheduler.service';
import { MonitoringWorker } from './application/workers/monitoring.worker';
import { FAILURE_COUNTER_STORE } from './domain/ports/failure-counter-store.port';
import { KEY_HEALTH_METRICS } from './domain/ports/key-health-metrics.port';
import { KEY_PROBES } from './domain/ports/key-probe.port';
import { KEY_HEALTH_RUN_LOCK } from './domain/ports/run-lock.port';
import { KEY_HEALTH_REPOSITORY } from './domain/repositories/key-health.repository';
import { MdblistKeyProbe } from './infrastructure/adapters/mdblist-key-probe.adapter';
import { OmdbKeyProbe } from './infrastructure/adapters/omdb-key-probe.adapter';
import { S3KeyProbe } from './infrastructure/adapters/s3-key-probe.adapter';
import { TmdbKeyProbe } from './infrastructure/adapters/tmdb-key-probe.adapter';
import { TraktKeyProbe } from './infrastructure/adapters/trakt-key-probe.adapter';
import {
  MONITORING_REDIS_CLIENT,
  RedisFailureCounterStore,
} from './infrastructure/counters/redis-failure-counter.store';
import { RedisRunLockAdapter } from './infrastructure/locks/redis-run-lock.adapter';
import { KeyHealthGaugesObserver } from './infrastructure/metrics/key-health-gauges.observer';
import { OtelKeyHealthMetricsAdapter } from './infrastructure/metrics/otel-key-health-metrics.adapter';
import { DrizzleKeyHealthRepository } from './infrastructure/repositories/drizzle-key-health.repository';
import {
  MONITORING_QUEUE,
  MONITORING_REDIS_COMMAND_TIMEOUT_MS,
  MONITORING_REDIS_MAX_RETRIES_PER_REQUEST,
} from './monitoring.constants';
import { MonitoringController } from './presentation/controllers/monitoring.controller';

@Module({
  imports: [
    ConfigModule.forFeature(tmdbConfig),
    ConfigModule.forFeature(traktConfig),
    ConfigModule.forFeature(mdblistConfig),
    ConfigModule.forFeature(omdbConfig),
    ConfigModule.forFeature(schedulerConfig),
    BullModule.registerQueue({
      name: MONITORING_QUEUE,
      defaultJobOptions: {
        removeOnComplete: { age: 3600, count: 200 },
        removeOnFail: { age: 86400, count: 100 },
      },
    }),
  ],
  controllers: apiOnly(MonitoringController),
  providers: [
    TmdbKeyProbe,
    TraktKeyProbe,
    MdblistKeyProbe,
    OmdbKeyProbe,
    S3KeyProbe,
    {
      provide: KEY_PROBES,
      useFactory: (
        tmdb: TmdbKeyProbe,
        trakt: TraktKeyProbe,
        mdblist: MdblistKeyProbe,
        omdb: OmdbKeyProbe,
        s3: S3KeyProbe,
      ) => [tmdb, trakt, mdblist, omdb, s3],
      inject: [TmdbKeyProbe, TraktKeyProbe, MdblistKeyProbe, OmdbKeyProbe, S3KeyProbe],
    },
    {
      provide: KEY_HEALTH_REPOSITORY,
      useClass: DrizzleKeyHealthRepository,
    },
    {
      provide: MONITORING_REDIS_CLIENT,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL');
        if (redisUrl) {
          const url = new URL(redisUrl);
          const port = url.port ? Number(url.port) : 6379;
          const password = url.password ? decodeURIComponent(url.password) : undefined;
          return new IORedis({
            host: url.hostname,
            port,
            ...(password && { password }),
            ...(url.protocol === 'rediss:' && { tls: {} }),
            maxRetriesPerRequest: MONITORING_REDIS_MAX_RETRIES_PER_REQUEST,
            commandTimeout: MONITORING_REDIS_COMMAND_TIMEOUT_MS,
          });
        }
        return new IORedis({
          host: config.get('REDIS_HOST') ?? 'localhost',
          port: config.get('REDIS_PORT') ?? 6379,
          maxRetriesPerRequest: MONITORING_REDIS_MAX_RETRIES_PER_REQUEST,
          commandTimeout: MONITORING_REDIS_COMMAND_TIMEOUT_MS,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: FAILURE_COUNTER_STORE,
      useClass: RedisFailureCounterStore,
    },
    {
      provide: KEY_HEALTH_RUN_LOCK,
      useClass: RedisRunLockAdapter,
    },
    {
      provide: KEY_HEALTH_METRICS,
      useClass: OtelKeyHealthMetricsAdapter,
    },
    KeyHealthService,
    ...workerOnly(MonitoringSchedulerService, MonitoringWorker, KeyHealthGaugesObserver),
    ExternalApiFailureListener,
  ],
})
export class MonitoringModule {}
