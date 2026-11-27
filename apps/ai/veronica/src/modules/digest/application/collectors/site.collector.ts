import { Inject, Injectable } from '@nestjs/common';

import { BASELINE_OFFSET_DAYS } from '../../digest.constants';
import type { Measured } from '../../domain/entities/measured';
import type { SiteStats } from '../../domain/entities/snapshot';
import type { SourceReading } from '../../domain/entities/source-reading';
import { available, unavailable } from '../../domain/entities/source-reading';
import { METRICS_PORT, type MetricsPort } from '../../domain/ports/metrics.port';

import {
  siteBotRequests,
  siteLabelledRequests,
  siteLoopDelayP99,
  sitePeakRss,
  siteRenderP95,
  siteRequests,
  siteServerErrors,
} from '@ratingo/ai-ops-tools';

import { baselineAt, guarded } from './collector-helpers';

const NONE = 0;

interface SiteReading {
  requests: number | null;
  serverErrors: number | null;
  renderP95: number | null;
  peakRss: number | null;
  loopDelayP99: number | null;
  labelled: number | null;
  bots: number | null;
}

const pair = (current: number, baseline: number | null): Measured => ({
  current: Math.round(current),
  baseline: baseline === null ? null : Math.round(baseline),
});

const optionalPair = (current: number | null, baseline: number | null): Measured | null =>
  current === null ? null : { current, baseline };

const shareOf = (bots: number | null, labelled: number): number =>
  labelled > 0 ? (bots ?? NONE) / labelled : NONE;

const botShareOf = (now: SiteReading, before: SiteReading): Measured | null =>
  now.labelled === null
    ? null
    : {
        current: shareOf(now.bots, now.labelled),
        baseline: before.labelled === null ? null : shareOf(before.bots, before.labelled),
      };

@Injectable()
export class SiteCollector {
  constructor(@Inject(METRICS_PORT) private readonly metrics: MetricsPort) {}

  collect(nowMs: number): Promise<SourceReading<SiteStats>> {
    return guarded(async () => {
      const [now, before] = await Promise.all([
        this.readAt(nowMs),
        this.readAt(baselineAt(nowMs, BASELINE_OFFSET_DAYS)),
      ]);
      if (now.requests === null) {
        return unavailable('метрик запитів сайту немає');
      }
      return available({
        requests24h: pair(now.requests, before.requests),
        serverErrors24h: pair(
          Math.round(now.serverErrors ?? NONE),
          before.requests === null ? null : Math.round(before.serverErrors ?? NONE),
        ),
        renderP95Seconds: optionalPair(now.renderP95, before.renderP95),
        peakRssBytes: optionalPair(now.peakRss, before.peakRss),
        eventLoopDelayP99Seconds: optionalPair(now.loopDelayP99, before.loopDelayP99),
        botShare: botShareOf(now, before),
      });
    });
  }

  private async readAt(atMs: number): Promise<SiteReading> {
    const [requests, serverErrors, renderP95, peakRss, loopDelayP99, labelled, bots] =
      await Promise.all(
        [
          siteRequests(),
          siteServerErrors(),
          siteRenderP95(),
          sitePeakRss(),
          siteLoopDelayP99(),
          siteLabelledRequests(),
          siteBotRequests(),
        ].map(async (query) => (await this.metrics.instant(query, atMs))[0]?.value ?? null),
      );
    return { requests, serverErrors, renderP95, peakRss, loopDelayP99, labelled, bots };
  }
}
