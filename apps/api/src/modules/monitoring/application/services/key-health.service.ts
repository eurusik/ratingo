import { Inject, Injectable, Logger } from '@nestjs/common';

import { API_KEY_STATUS } from '../../domain/constants/api-key-status.const';
import {
  MONITORED_PROVIDERS,
  type MonitoredProvider,
  isMonitoredProvider,
} from '../../domain/constants/monitored-provider.const';
import {
  type KeyHealthSnapshot,
  type ProviderKeyHealth,
  type SaveKeyHealthInput,
} from '../../domain/entities/key-health-snapshot.entity';
import {
  FAILURE_COUNTER_STORE,
  type FailureCounterStore,
} from '../../domain/ports/failure-counter-store.port';
import {
  KEY_HEALTH_METRICS,
  type KeyHealthMetricsPort,
} from '../../domain/ports/key-health-metrics.port';
import { KEY_PROBES, type KeyProbe } from '../../domain/ports/key-probe.port';
import { KEY_HEALTH_RUN_LOCK, type RunLock } from '../../domain/ports/run-lock.port';
import {
  KEY_HEALTH_REPOSITORY,
  type KeyHealthRepository,
} from '../../domain/repositories/key-health.repository';

@Injectable()
export class KeyHealthService {
  private readonly logger = new Logger(KeyHealthService.name);

  constructor(
    @Inject(KEY_PROBES) private readonly probes: KeyProbe[],
    @Inject(KEY_HEALTH_REPOSITORY) private readonly repository: KeyHealthRepository,
    @Inject(FAILURE_COUNTER_STORE) private readonly failures: FailureCounterStore,
    @Inject(KEY_HEALTH_RUN_LOCK) private readonly runLock: RunLock,
    @Inject(KEY_HEALTH_METRICS) private readonly metrics: KeyHealthMetricsPort,
  ) {}

  async runChecks(): Promise<void> {
    const outcomes = await this.runLock.withLock(() =>
      Promise.allSettled(this.probes.map((probe) => this.runSingle(probe))),
    );
    if (outcomes === null) {
      this.logger.warn('Key-health check already running — skipped this trigger');
      return;
    }
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'rejected') {
        this.logFailedCheck(this.probes[index].provider, outcome.reason);
      }
    });
  }

  async getDashboard(): Promise<ProviderKeyHealth[]> {
    const latest = await this.repository.findLatestPerProvider();
    const latestByProvider = new Map(latest.map((snapshot) => [snapshot.provider, snapshot]));

    return Promise.all(
      MONITORED_PROVIDERS.map(async (provider) => ({
        provider,
        latest: latestByProvider.get(provider) ?? null,
        failures: await this.failures.get(provider),
      })),
    );
  }

  async getHistory(provider: MonitoredProvider, limit: number): Promise<KeyHealthSnapshot[]> {
    return this.repository.findHistory(provider, limit);
  }

  async recordFailure(provider: string, statusCode: number): Promise<void> {
    if (!isMonitoredProvider(provider)) return;
    this.metrics.recordFailure(provider, statusCode);
    await this.failures.increment(provider, statusCode);
  }

  private async runSingle(probe: KeyProbe): Promise<void> {
    const result = await probe.probe();

    const snapshot: SaveKeyHealthInput = {
      provider: probe.provider,
      status: result.status,
      statusCode: result.statusCode ?? null,
      latencyMs: result.latencyMs ?? null,
      detail: result.detail ?? null,
      quotaRemaining: result.quotaRemaining ?? null,
      quotaLimit: result.quotaLimit ?? null,
    };

    await this.repository.save(snapshot);
    this.logOutcome(snapshot);
  }

  private logFailedCheck(provider: MonitoredProvider, reason: unknown): void {
    const detail = reason instanceof Error ? reason.message : String(reason);
    this.logger.error(`Failed to record ${provider} key health: ${detail}`);
  }

  private logOutcome(snapshot: SaveKeyHealthInput): void {
    const label = `${snapshot.provider} key — ${snapshot.detail ?? snapshot.status}`;
    if (snapshot.status === API_KEY_STATUS.INVALID) {
      this.logger.error(`INVALID: ${label}`);
    } else if (snapshot.status === API_KEY_STATUS.DEGRADED) {
      this.logger.warn(`DEGRADED: ${label}`);
    } else {
      this.logger.debug(`${snapshot.status}: ${label}`);
    }
  }
}
