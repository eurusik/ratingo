import fc from 'fast-check';

import {
  DEFAULT_BASELINE_PATH,
  DEFAULT_JUDGE_MODEL,
  InvalidEvalOptionError,
  parseEvalOptions,
} from './eval-options';

describe('parseEvalOptions', () => {
  it('runs each case three times and passes at two on a real model', () => {
    expect(parseEvalOptions([], false)).toMatchObject({
      runs: 3,
      passAt: 2,
      judgeModel: DEFAULT_JUDGE_MODEL,
      baselinePath: DEFAULT_BASELINE_PATH,
      saveBaseline: false,
      forceBaseline: false,
      calibrate: false,
      calibrateOnly: false,
      only: null,
      dumpPath: null,
    });
  });

  it('runs each case once on the stub', () => {
    expect(parseEvalOptions([], true)).toMatchObject({ runs: 1, passAt: 1 });
  });

  it('takes the majority of a custom number of runs unless told otherwise', () => {
    expect(parseEvalOptions(['--runs=5'], false)).toMatchObject({ runs: 5, passAt: 3 });
    expect(parseEvalOptions(['--runs=5', '--pass-at=4'], false)).toMatchObject({
      runs: 5,
      passAt: 4,
    });
  });

  it('reads the other flags', () => {
    expect(
      parseEvalOptions(
        [
          '--concurrency=6',
          '--max-cost-usd=2.5',
          '--judge-model=anthropic:claude-opus-5-5',
          '--baseline=/tmp/b.json',
          '--save-baseline',
          '--calibrate',
          '--dump=/tmp/d.json',
        ],
        false,
      ),
    ).toMatchObject({
      concurrency: 6,
      maxCostUsd: 2.5,
      judgeModel: 'anthropic:claude-opus-5-5',
      baselinePath: '/tmp/b.json',
      saveBaseline: true,
      calibrate: true,
      dumpPath: '/tmp/d.json',
    });
  });

  it('reads --force-baseline together with --save-baseline', () => {
    expect(parseEvalOptions(['--save-baseline', '--force-baseline'], false)).toMatchObject({
      saveBaseline: true,
      forceBaseline: true,
    });
  });

  it('lets calibrate-only imply calibrate and selects cases with --only', () => {
    expect(parseEvalOptions(['--calibrate-only'], false)).toMatchObject({
      calibrate: true,
      calibrateOnly: true,
    });
    expect(parseEvalOptions(['--only=a, b'], false).only).toEqual(['a', 'b']);
  });

  it.each([
    ['--runs=0'],
    ['--runs=abc'],
    ['--runs=3', '--pass-at=4'],
    ['--runs=2.5'],
    ['--concurrency=-1'],
    ['--unknown=1'],
    ['--save-baseline=yes'],
    ['--runs'],
    ['plain'],
    ['--only=a', '--save-baseline'],
    ['--force-baseline'],
  ])('rejects %j', (...argv) => {
    expect(() => parseEvalOptions(argv, false)).toThrow(InvalidEvalOptionError);
  });

  it('always yields a pass threshold between one and the number of runs', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 15 }), (runs) => {
        const options = parseEvalOptions([`--runs=${runs}`], false);
        expect(options.passAt).toBeGreaterThanOrEqual(1);
        expect(options.passAt).toBeLessThanOrEqual(runs);
      }),
    );
  });
});
