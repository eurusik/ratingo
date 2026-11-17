import type { ReadableSpan, SpanProcessor } from '@opentelemetry/sdk-trace-node';

import { SampledExportProcessor, isTraceSampled } from './sampled-export-processor';

const LOW_TRACE_ID = '0000000f00000000000000000000000a';
const HIGH_TRACE_ID = 'ffffffff00000000000000000000000a';

const spanOf = (traceId: string) =>
  ({ spanContext: () => ({ traceId }) }) as unknown as ReadableSpan;

function fakeExportProcessor() {
  return {
    onStart: jest.fn(),
    onEnd: jest.fn(),
    forceFlush: jest.fn().mockResolvedValue(undefined),
    shutdown: jest.fn().mockResolvedValue(undefined),
  } satisfies SpanProcessor;
}

describe('isTraceSampled', () => {
  it('keeps every trace at ratio 1 and none at ratio 0', () => {
    expect(isTraceSampled(HIGH_TRACE_ID, 1)).toBe(true);
    expect(isTraceSampled(LOW_TRACE_ID, 0)).toBe(false);
  });

  it('decides by the trace id, so all spans of one trace share the decision', () => {
    expect(isTraceSampled(LOW_TRACE_ID, 0.1)).toBe(true);
    expect(isTraceSampled(HIGH_TRACE_ID, 0.1)).toBe(false);
  });
});

describe('SampledExportProcessor', () => {
  it('forwards only sampled traces to the export processor', () => {
    const exportProcessor = fakeExportProcessor();
    const processor = new SampledExportProcessor(exportProcessor, 0.1);

    const sampledSpan = spanOf(LOW_TRACE_ID);
    processor.onEnd(sampledSpan);
    processor.onEnd(spanOf(HIGH_TRACE_ID));

    expect(exportProcessor.onEnd).toHaveBeenCalledTimes(1);
    expect(exportProcessor.onEnd).toHaveBeenCalledWith(sampledSpan);
  });

  it('flushes and shuts down the export processor', async () => {
    const exportProcessor = fakeExportProcessor();
    const processor = new SampledExportProcessor(exportProcessor, 0.1);

    await processor.forceFlush();
    await processor.shutdown();

    expect(exportProcessor.forceFlush).toHaveBeenCalled();
    expect(exportProcessor.shutdown).toHaveBeenCalled();
  });
});
