import * as fc from 'fast-check';

import { AlertKey } from '../constants/watchdog-rules.constants';
import { HappyProbe } from '../entities/happy-probe';

import { evaluateHappy, nextHappyFailures } from './happy-health.policy';

describe('Happy health', () => {
  it('does not alert on a single failed check', () => {
    expect(evaluateHappy(1, HappyProbe.DOWN)?.finding).toBeNull();
  });

  it('alerts on the second consecutive failure and names the minutes', () => {
    const result = evaluateHappy(2, HappyProbe.DOWN);
    expect(result?.key).toBe(AlertKey.HAPPY_DOWN);
    expect(result?.finding?.text).toContain('10 хв');
    expect(result?.finding?.text).toContain('Railway → happy → Deployments');
  });

  it('is not evaluated when the Happy URL is not configured', () => {
    expect(evaluateHappy(0, HappyProbe.SKIPPED)).toBeNull();
  });

  it('counts consecutive failures and resets on any success or skip', () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...Object.values(HappyProbe))), (probes) => {
        const failures = probes.reduce(nextHappyFailures, 0);
        let trailing = 0;
        for (
          let index = probes.length - 1;
          index >= 0 && probes[index] === HappyProbe.DOWN;
          index--
        ) {
          trailing++;
        }
        expect(failures).toBe(trailing);
      }),
    );
  });

  it('recovers as soon as one check passes', () => {
    expect(evaluateHappy(nextHappyFailures(5, HappyProbe.UP), HappyProbe.UP)?.finding).toBeNull();
  });
});
