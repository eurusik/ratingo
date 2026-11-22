import { Inject, Injectable } from '@nestjs/common';

import type { ApiKeyStat } from '../../domain/entities/snapshot';
import { ApiKeyState } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { UNKNOWN_LABEL } from '../../domain/constants/digest-text.constants';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import { guarded } from './collector-helpers';

const API_KEY_STATUS = 'last_over_time(app_api_key_status[6h])';

const stateOf = (value: number): ApiKeyState => {
  if (value >= 1) return ApiKeyState.VALID;
  if (value > 0) return ApiKeyState.DEGRADED;
  if (value === 0) return ApiKeyState.INVALID;
  return ApiKeyState.UNKNOWN;
};

@Injectable()
export class ApiKeysCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<ApiKeyStat[]>> {
    return guarded(async () => {
      const samples = await this.metrics.instant(API_KEY_STATUS, nowMs);
      if (samples.length === 0) {
        return unavailable('метрик ключів немає');
      }
      return available(
        samples
          .map((sample): ApiKeyStat => ({
            provider: sample.labels.provider ?? UNKNOWN_LABEL,
            state: stateOf(sample.value),
          }))
          .sort((a, b) => a.provider.localeCompare(b.provider)),
      );
    });
  }
}
