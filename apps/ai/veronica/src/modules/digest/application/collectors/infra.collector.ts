import { Inject, Injectable } from '@nestjs/common';

import type { InfraStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import { guarded } from './collector-helpers';

const DATABASE_UP = 'min(last_over_time(pg_up[15m]))';
const REDIS_UP = 'min(last_over_time(redis_up[15m]))';
const REDIS_MEMORY =
  'max(last_over_time(redis_memory_used_bytes[15m]) / (last_over_time(redis_memory_max_bytes[15m]) > 0))';

@Injectable()
export class InfraCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<InfraStats>> {
    return guarded(async () => {
      const [database, redis, memory] = await Promise.all([
        this.metrics.instant(DATABASE_UP, nowMs),
        this.metrics.instant(REDIS_UP, nowMs),
        this.metrics.instant(REDIS_MEMORY, nowMs),
      ]);
      const databaseUp = database[0]?.value;
      const redisUp = redis[0]?.value;
      if (databaseUp === undefined || redisUp === undefined) {
        return unavailable('метрик бази або Redis немає');
      }
      return available({
        databaseUp: databaseUp >= 1,
        redisUp: redisUp >= 1,
        redisMemoryUsedRatio: memory[0]?.value ?? null,
      });
    });
  }
}
