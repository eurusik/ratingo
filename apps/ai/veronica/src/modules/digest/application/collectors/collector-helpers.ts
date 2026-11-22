import type { MetricSample } from '../../domain/ports/metrics.port';
import type { SourceReading } from '../../domain/entities/source-reading';
import { unavailable } from '../../domain/entities/source-reading';

const MAX_REASON_LENGTH = 120;
const MS_PER_SECOND = 1000;
const MS_PER_HOUR = 60 * 60 * MS_PER_SECOND;
const MS_PER_DAY = 24 * MS_PER_HOUR;

export const baselineAt = (nowMs: number, days: number): number => nowMs - days * MS_PER_DAY;

export const hoursSince = (epochSeconds: number, nowMs: number): number =>
  Math.max(0, (nowMs - epochSeconds * MS_PER_SECOND) / MS_PER_HOUR);

export const guarded = async <T>(
  collect: () => Promise<SourceReading<T>>,
): Promise<SourceReading<T>> => {
  try {
    return await collect();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'невідома помилка';
    return unavailable(`запит не вдався: ${message.slice(0, MAX_REASON_LENGTH)}`);
  }
};

export const valueByLabel = (
  samples: readonly MetricSample[],
  label: string,
): Map<string, number> =>
  new Map(samples.map((sample) => [sample.labels[label] ?? '', sample.value]));
