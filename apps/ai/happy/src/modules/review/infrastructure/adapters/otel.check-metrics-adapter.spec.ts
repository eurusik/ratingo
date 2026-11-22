import type { Meter } from '@opentelemetry/api';

import {
  CHECK_ID_ATTRIBUTE,
  CHECK_METRIC_NAME,
  CHECK_OUTCOME_ATTRIBUTE,
  OtelCheckMetricsAdapter,
} from './otel.check-metrics-adapter';

describe('OtelCheckMetricsAdapter', () => {
  const setup = () => {
    const add = jest.fn();
    const createCounter = jest.fn().mockReturnValue({ add });
    const adapter = new OtelCheckMetricsAdapter(
      { createCounter } as unknown as Meter,
      new Set(['race', 'upsert']),
    );
    return { add, createCounter, adapter };
  };

  it('counts an outcome per check with a bounded label set', () => {
    const { add, createCounter, adapter } = setup();
    adapter.record('race', 'selected');
    adapter.record('upsert', 'question');
    expect(createCounter).toHaveBeenCalledWith(CHECK_METRIC_NAME, expect.any(Object));
    expect(add).toHaveBeenNthCalledWith(1, 1, {
      [CHECK_ID_ATTRIBUTE]: 'race',
      [CHECK_OUTCOME_ATTRIBUTE]: 'selected',
    });
    expect(add).toHaveBeenCalledTimes(2);
  });

  it('never records an id that is not in the catalog', () => {
    const { add, adapter } = setup();
    adapter.record('made-up-by-the-model', 'finding');
    expect(add).not.toHaveBeenCalled();
  });
});
