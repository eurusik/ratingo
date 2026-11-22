import { Inject, Injectable } from '@nestjs/common';

import { BASELINE_OFFSET_DAYS } from '../../digest.constants';
import { measured } from '../../domain/entities/measured';
import type { BackupStats } from '../../domain/entities/snapshot';
import { BackupResult } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import { BACKUP_LAST_RUNS, BACKUP_SIZE } from '../../domain/queries/prom-queries';

import { baselineAt, guarded, hoursSince } from './collector-helpers';

const isBackupResult = (value: string | undefined): value is BackupResult =>
  value === BackupResult.SUCCESS || value === BackupResult.FAILURE;

@Injectable()
export class BackupCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<BackupStats>> {
    return guarded(async () => {
      const [runs, size, baselineSize] = await Promise.all([
        this.metrics.instant(BACKUP_LAST_RUNS, nowMs),
        this.metrics.instant(BACKUP_SIZE, nowMs),
        this.metrics.instant(BACKUP_SIZE, baselineAt(nowMs, BASELINE_OFFSET_DAYS)),
      ]);
      const latest = [...runs].sort((a, b) => b.value - a.value)[0];
      if (latest === undefined) {
        return unavailable('метрик бекапу немає');
      }
      const result = latest.labels.result;
      const currentSize = size[0]?.value;
      return available({
        lastRunAgeHours: hoursSince(latest.value, nowMs),
        lastResult: isBackupResult(result) ? result : null,
        sizeBytes:
          currentSize === undefined ? null : measured(currentSize, baselineSize[0]?.value ?? null),
      });
    });
  }
}
