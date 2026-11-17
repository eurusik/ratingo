import type { Context } from '@opentelemetry/api';
import type { ReadableSpan, Span, SpanProcessor } from '@opentelemetry/sdk-trace-node';

import { TRACE_ID_PREFIX_HEX_LENGTH, TRACE_ID_PREFIX_RANGE } from './constants';

const HEX_RADIX = 16;

export const isTraceSampled = (traceId: string, ratio: number): boolean =>
  Number.parseInt(traceId.slice(0, TRACE_ID_PREFIX_HEX_LENGTH), HEX_RADIX) / TRACE_ID_PREFIX_RANGE <
  ratio;

export class SampledExportProcessor implements SpanProcessor {
  constructor(
    private readonly exportProcessor: SpanProcessor,
    private readonly ratio: number,
  ) {}

  onStart(span: Span, parentContext: Context): void {
    this.exportProcessor.onStart(span, parentContext);
  }

  onEnd(span: ReadableSpan): void {
    if (isTraceSampled(span.spanContext().traceId, this.ratio)) {
      this.exportProcessor.onEnd(span);
    }
  }

  forceFlush(): Promise<void> {
    return this.exportProcessor.forceFlush();
  }

  shutdown(): Promise<void> {
    return this.exportProcessor.shutdown();
  }
}
