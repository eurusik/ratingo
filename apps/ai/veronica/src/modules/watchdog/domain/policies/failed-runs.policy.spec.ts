import * as fc from 'fast-check';

import { evaluateFailedRuns } from './failed-runs.policy';

describe('failed runs watchdog', () => {
  it('alerts from three failed runs upward', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1000 }), (count) => {
        expect(evaluateFailedRuns(count).finding !== null).toBe(count >= 3);
      }),
    );
  });

  it('puts the count into the text', () => {
    expect(evaluateFailedRuns(4).finding?.text).toContain('4 невдалих');
  });
});
