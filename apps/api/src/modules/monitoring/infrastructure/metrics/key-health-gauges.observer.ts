import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';

import {
  type BatchObservableCallback,
  type Meter,
  metrics,
  type ObservableGauge,
} from '@opentelemetry/api';

import { MS_PER_SECOND } from '../../../../common/constants';
import {
  API_KEY_LAST_CHECKED_METRIC,
  API_KEY_PROBE_LATENCY_METRIC,
  API_KEY_STATUS_METRIC,
  METER_NAME,
} from '../../../../telemetry/telemetry.constants';
import { API_KEY_STATUS, type ApiKeyStatus } from '../../domain/constants/api-key-status.const';
import {
  KEY_HEALTH_REPOSITORY,
  type KeyHealthRepository,
} from '../../domain/repositories/key-health.repository';

const STATUS_VALUE: Record<ApiKeyStatus, number> = {
  [API_KEY_STATUS.VALID]: 1,
  [API_KEY_STATUS.DEGRADED]: 0.5,
  [API_KEY_STATUS.INVALID]: 0,
  [API_KEY_STATUS.UNKNOWN]: -1,
};

@Injectable()
export class KeyHealthGaugesObserver implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KeyHealthGaugesObserver.name);
  private readonly meter: Meter = metrics.getMeter(METER_NAME);
  private statusGauge?: ObservableGauge;
  private latencyGauge?: ObservableGauge;
  private lastCheckedGauge?: ObservableGauge;

  constructor(@Inject(KEY_HEALTH_REPOSITORY) private readonly repository: KeyHealthRepository) {}

  onModuleInit(): void {
    this.statusGauge = this.meter.createObservableGauge(API_KEY_STATUS_METRIC, {
      description: 'External API-key health: 1 valid, 0.5 degraded, 0 invalid, -1 unknown',
    });
    this.latencyGauge = this.meter.createObservableGauge(API_KEY_PROBE_LATENCY_METRIC, {
      description: 'Latency of the latest key-health probe',
      unit: 'ms',
    });
    this.lastCheckedGauge = this.meter.createObservableGauge(API_KEY_LAST_CHECKED_METRIC, {
      description: 'Unix time of the latest persisted key-health probe',
      unit: 's',
    });
    this.meter.addBatchObservableCallback(this.observe, this.gauges());
  }

  onModuleDestroy(): void {
    const gauges = this.gauges();
    if (gauges.length > 0) {
      this.meter.removeBatchObservableCallback(this.observe, gauges);
    }
  }

  private gauges(): ObservableGauge[] {
    const { statusGauge, latencyGauge, lastCheckedGauge } = this;
    return statusGauge && latencyGauge && lastCheckedGauge
      ? [statusGauge, latencyGauge, lastCheckedGauge]
      : [];
  }

  private readonly observe: BatchObservableCallback = async (result) => {
    const { statusGauge, latencyGauge, lastCheckedGauge } = this;
    if (!statusGauge || !latencyGauge || !lastCheckedGauge) {
      return;
    }
    try {
      const snapshots = await this.repository.findLatestPerProvider();
      snapshots.forEach(({ provider, status, latencyMs, checkedAt }) => {
        result.observe(statusGauge, STATUS_VALUE[status], { provider });
        result.observe(lastCheckedGauge, Math.floor(checkedAt.getTime() / MS_PER_SECOND), {
          provider,
        });
        if (latencyMs !== null) {
          result.observe(latencyGauge, latencyMs, { provider });
        }
      });
    } catch (error) {
      this.logger.warn(
        `Failed to read key health for metrics: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
}
