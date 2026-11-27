import { Inject, Injectable } from '@nestjs/common';

import { BASELINE_OFFSET_DAYS } from '../../digest.constants';
import { measured } from '../../domain/entities/measured';
import type { HttpErrorStat } from '../../domain/entities/snapshot';
import { HttpErrorKind } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { UNKNOWN_LABEL } from '../../domain/constants/digest-text.constants';
import { METRICS_PORT, type MetricsPort, type MetricSample } from '../../domain/ports/metrics.port';

import { clientErrors, clientRequests } from '@ratingo/ai-ops-tools';

import { baselineAt, guarded } from './collector-helpers';

const ANY_REQUESTS = clientRequests();
const RELEVANT_ERRORS = clientErrors();

const KIND_BY_STATUS: Readonly<Record<string, HttpErrorKind>> = {
  '401': HttpErrorKind.AUTH,
  '403': HttpErrorKind.AUTH,
  '429': HttpErrorKind.RATE_LIMIT,
};

const keyOf = (server: string, kind: HttpErrorKind): string => `${server}|${kind}`;

const countByServerAndKind = (samples: readonly MetricSample[]): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    const kind = KIND_BY_STATUS[sample.labels.http_response_status_code ?? ''];
    if (kind !== undefined) {
      const key = keyOf(sample.labels.server_address ?? UNKNOWN_LABEL, kind);
      counts.set(key, (counts.get(key) ?? 0) + sample.value);
    }
  }
  return counts;
};

@Injectable()
export class HttpErrorsCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<HttpErrorStat[]>> {
    return guarded(async () => {
      const baselineMs = baselineAt(nowMs, BASELINE_OFFSET_DAYS);
      const [anyRequests, errors, baselineRequests, baselineErrors] = await Promise.all([
        this.metrics.instant(ANY_REQUESTS, nowMs),
        this.metrics.instant(RELEVANT_ERRORS, nowMs),
        this.metrics.instant(ANY_REQUESTS, baselineMs),
        this.metrics.instant(RELEVANT_ERRORS, baselineMs),
      ]);
      const baselineKnown = baselineRequests.length > 0;
      if (anyRequests.length === 0) {
        return unavailable('метрик вихідних запитів немає');
      }
      const current = countByServerAndKind(errors);
      const baseline = countByServerAndKind(baselineErrors);
      return available(
        [...current.entries()]
          .map(([key, count]): HttpErrorStat => {
            const [server = '', kind = ''] = key.split('|');
            return {
              server,
              kind: kind as HttpErrorKind,
              count: measured(
                Math.round(count),
                baselineKnown ? Math.round(baseline.get(key) ?? 0) : null,
              ),
            };
          })
          .sort((a, b) => a.server.localeCompare(b.server)),
      );
    });
  }
}
