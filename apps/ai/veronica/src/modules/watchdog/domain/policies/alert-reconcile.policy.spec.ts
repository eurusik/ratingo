import * as fc from 'fast-check';

import { ALERT_KEYS, AlertKey } from '../constants/watchdog-rules.constants';
import { failing, healthy, type CheckResult } from '../entities/check-result';

import { reconcileAlerts } from './alert-reconcile.policy';

const keySet = fc.subarray([...ALERT_KEYS]);

const resultsFor = (keys: readonly AlertKey[], failingKeys: ReadonlySet<AlertKey>): CheckResult[] =>
  keys.map((key) => (failingKeys.has(key) ? failing(key, `text ${key}`) : healthy(key)));

describe('reconcileAlerts', () => {
  it('raises a new failure once and recovers it once', () => {
    const first = reconcileAlerts([], [failing(AlertKey.HAPPY_DOWN, 'down')]);
    expect(first.raised).toHaveLength(1);
    expect(first.active).toEqual([AlertKey.HAPPY_DOWN]);

    const second = reconcileAlerts(first.active, [failing(AlertKey.HAPPY_DOWN, 'down 15')]);
    expect(second.raised).toEqual([]);
    expect(second.recovered).toEqual([]);

    const third = reconcileAlerts(second.active, [healthy(AlertKey.HAPPY_DOWN)]);
    expect(third.recovered).toEqual([AlertKey.HAPPY_DOWN]);
    expect(third.active).toEqual([]);

    expect(reconcileAlerts(third.active, [healthy(AlertKey.HAPPY_DOWN)])).toEqual({
      raised: [],
      recovered: [],
      active: [],
    });
  });

  it('never spams: the same readings twice in a row produce no messages the second time', () => {
    fc.assert(
      fc.property(keySet, keySet, keySet, (previous, evaluated, failingKeys) => {
        const results = resultsFor(evaluated, new Set(failingKeys));
        const once = reconcileAlerts(previous, results);
        const twice = reconcileAlerts(once.active, results);
        expect(twice.raised).toEqual([]);
        expect(twice.recovered).toEqual([]);
        expect(twice.active).toEqual(once.active);
      }),
    );
  });

  it('only raises keys that were not active and only recovers keys that were', () => {
    fc.assert(
      fc.property(keySet, keySet, keySet, (previous, evaluated, failingKeys) => {
        const out = reconcileAlerts(previous, resultsFor(evaluated, new Set(failingKeys)));
        for (const finding of out.raised) expect(previous).not.toContain(finding.key);
        for (const key of out.recovered) expect(previous).toContain(key);
      }),
    );
  });

  it('keeps an alert active when its check was not evaluated this tick', () => {
    const out = reconcileAlerts([AlertKey.FAILED_RUNS], [healthy(AlertKey.HAPPY_DOWN)]);
    expect(out.active).toEqual([AlertKey.FAILED_RUNS]);
    expect(out.recovered).toEqual([]);
  });

  it('ends with exactly the failing keys plus the carried-over unevaluated ones', () => {
    fc.assert(
      fc.property(keySet, keySet, keySet, (previous, evaluated, failingKeys) => {
        const failingSet = new Set(failingKeys.filter((key) => evaluated.includes(key)));
        const out = reconcileAlerts(previous, resultsFor(evaluated, failingSet));
        const expected = ALERT_KEYS.filter(
          (key) => failingSet.has(key) || (previous.includes(key) && !evaluated.includes(key)),
        );
        expect(out.active).toEqual(expected);
      }),
    );
  });
});
