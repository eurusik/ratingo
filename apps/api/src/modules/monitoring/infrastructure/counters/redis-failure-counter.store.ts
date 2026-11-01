import { randomUUID } from 'node:crypto';

import { HttpStatus, Inject, Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';

import IORedis from 'ioredis';

import { type MonitoredProvider } from '../../domain/constants/monitored-provider.const';
import { type ProviderFailureCounts } from '../../domain/entities/key-health-snapshot.entity';
import { type FailureCounterStore } from '../../domain/ports/failure-counter-store.port';

export const MONITORING_REDIS_CLIENT = Symbol('MONITORING_REDIS_CLIENT');

const WINDOW_MS = 86_400_000;

type FailureBucket = keyof ProviderFailureCounts;

@Injectable()
export class RedisFailureCounterStore implements FailureCounterStore, OnModuleDestroy {
  private readonly logger = new Logger(RedisFailureCounterStore.name);

  constructor(@Inject(MONITORING_REDIS_CLIENT) private readonly redis: IORedis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }

  async increment(provider: MonitoredProvider, statusCode: number | undefined): Promise<void> {
    const bucket = this.bucketFor(statusCode);
    if (!bucket) return;

    const now = Date.now();
    const key = this.key(provider, bucket);

    try {
      await this.redis
        .multi()
        .zadd(key, now, `${now}-${randomUUID()}`)
        .zremrangebyscore(key, 0, now - WINDOW_MS)
        .pexpire(key, WINDOW_MS)
        .exec();
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to record ${provider} failure: ${detail}`);
    }
  }

  async get(provider: MonitoredProvider): Promise<ProviderFailureCounts> {
    const cutoff = Date.now() - WINDOW_MS;

    try {
      const results = await this.redis
        .multi()
        .zremrangebyscore(this.key(provider, 'unauthorized'), 0, cutoff)
        .zcard(this.key(provider, 'unauthorized'))
        .zremrangebyscore(this.key(provider, 'rateLimited'), 0, cutoff)
        .zcard(this.key(provider, 'rateLimited'))
        .exec();

      return {
        unauthorized: this.cardAt(results, 1),
        rateLimited: this.cardAt(results, 3),
      };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to read ${provider} failure counts: ${detail}`);
      return { unauthorized: 0, rateLimited: 0 };
    }
  }

  private cardAt(results: [Error | null, unknown][] | null, index: number): number {
    const entry = results?.[index];
    if (!entry || entry[0]) return 0;
    return Number(entry[1]) || 0;
  }

  private bucketFor(statusCode: number | undefined): FailureBucket | null {
    if (statusCode === HttpStatus.UNAUTHORIZED || statusCode === HttpStatus.FORBIDDEN) {
      return 'unauthorized';
    }
    if (statusCode === HttpStatus.TOO_MANY_REQUESTS) {
      return 'rateLimited';
    }
    return null;
  }

  private key(provider: MonitoredProvider, bucket: FailureBucket): string {
    return `monitoring:failures:${provider}:${bucket}`;
  }
}
