import { AI_METRIC_NAMES } from '@ratingo/ai-core';

import { OtelWatchdogHeartbeat } from './otel-watchdog-heartbeat';

describe('OtelWatchdogHeartbeat', () => {
  it('observes nothing until the first tick, then the last tick in unix seconds', () => {
    let callback: (observation: { observe: jest.Mock }) => void = () => undefined;
    const createObservableGauge = jest.fn().mockReturnValue({
      addCallback: (fn: typeof callback) => {
        callback = fn;
      },
    });
    const heartbeat = new OtelWatchdogHeartbeat({ createObservableGauge } as never);
    expect(createObservableGauge).toHaveBeenCalledWith(
      AI_METRIC_NAMES.WATCHDOG_LAST_TICK,
      expect.objectContaining({ unit: 's' }),
    );
    const before = { observe: jest.fn() };
    callback(before);
    expect(before.observe).not.toHaveBeenCalled();
    heartbeat.beat(1_800_000_123_456);
    const after = { observe: jest.fn() };
    callback(after);
    expect(after.observe).toHaveBeenCalledWith(1_800_000_123);
  });
});
