import { metrics, type Counter, type Meter } from '@opentelemetry/api';

import { AI_METRIC_ATTRIBUTES, AI_METRIC_NAMES } from '@ratingo/ai-core';

import { SERVICE_NAME } from '../../../../telemetry/telemetry.constants';
import type { ChatEvent, ChatMetricsPort } from '../../domain/ports/chat-metrics.port';

export class OtelChatMetrics implements ChatMetricsPort {
  private readonly events: Counter;

  constructor(meter: Meter = metrics.getMeter(SERVICE_NAME)) {
    this.events = meter.createCounter(AI_METRIC_NAMES.CHAT_EVENTS);
  }

  record(event: ChatEvent): void {
    this.events.add(1, {
      [AI_METRIC_ATTRIBUTES.OUTCOME]: event.outcome,
      [AI_METRIC_ATTRIBUTES.COMMAND]: event.command,
      [AI_METRIC_ATTRIBUTES.ROUTE]: event.route,
    });
  }
}
