import * as path from 'node:path';

import { InvalidEvalOptionError, parseEvalOptions } from './options';

describe('parseEvalOptions', () => {
  it('uses three runs and a majority for a real model and one run for the stub', () => {
    expect(parseEvalOptions([], false)).toMatchObject({ runs: 3, passAt: 2, concurrency: 3 });
    expect(parseEvalOptions([], true)).toMatchObject({ runs: 1, passAt: 1 });
  });

  it('looks for the baseline next to the eval, whatever the working directory', () => {
    expect(path.isAbsolute(parseEvalOptions([], false).baselinePath)).toBe(true);
    expect(parseEvalOptions([], false).baselinePath).toBe(path.join(__dirname, 'baseline.json'));
  });

  it('reads flags and a case list', () => {
    expect(
      parseEvalOptions(
        ['--runs=5', '--pass-at=3', '--only=a,b', '--max-cost-usd=2', '--dump=out.json'],
        false,
      ),
    ).toMatchObject({
      runs: 5,
      passAt: 3,
      only: ['a', 'b'],
      maxCostUsd: 2,
      dumpPath: 'out.json',
    });
  });

  it('reads --force-baseline together with --save-baseline', () => {
    expect(parseEvalOptions(['--save-baseline', '--force-baseline'], false)).toMatchObject({
      saveBaseline: true,
      forceBaseline: true,
    });
  });

  it.each([
    [['--runs=0']],
    [['--runs=3', '--pass-at=4']],
    [['--unknown']],
    [['loose']],
    [['--save-baseline', '--only=a']],
    [['--force-baseline']],
    [['--max-cost-usd=abc']],
    [['--concurrency=2.5']],
    [['--runs=2.5']],
  ])('rejects %j', (argv) => {
    expect(() => parseEvalOptions(argv, false)).toThrow(InvalidEvalOptionError);
  });
});
