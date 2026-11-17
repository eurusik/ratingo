import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';

import { metrics } from '@opentelemetry/api';
import { registerRuntimeMetrics } from '@ratingo/node-telemetry';

import { METER_NAME } from './telemetry.constants';

@Injectable()
export class RuntimeMetricsService implements OnModuleInit, OnModuleDestroy {
  private unregister?: () => void;

  onModuleInit(): void {
    this.unregister = registerRuntimeMetrics(metrics.getMeter(METER_NAME));
  }

  onModuleDestroy(): void {
    this.unregister?.();
    this.unregister = undefined;
  }
}
