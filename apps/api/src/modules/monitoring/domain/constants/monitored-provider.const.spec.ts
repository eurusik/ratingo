import * as fc from 'fast-check';

import { MONITORED_PROVIDERS, isMonitoredProvider } from './monitored-provider.const';

describe('isMonitoredProvider', () => {
  it('accepts every monitored provider', () => {
    for (const provider of MONITORED_PROVIDERS) {
      expect(isMonitoredProvider(provider)).toBe(true);
    }
  });

  it('rejects any string that is not a monitored provider', () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        fc.pre(!(MONITORED_PROVIDERS as readonly string[]).includes(value));
        expect(isMonitoredProvider(value)).toBe(false);
      }),
    );
  });
});
