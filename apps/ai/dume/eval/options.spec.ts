import { InvalidEvalOptionError, parseEvalOptions } from './options';

describe('parseEvalOptions', () => {
  it('uses three runs and a majority for a real model and one run for the stub', () => {
    expect(parseEvalOptions([], false)).toMatchObject({ runs: 3, passAt: 2, concurrency: 3 });
    expect(parseEvalOptions([], true)).toMatchObject({ runs: 1, passAt: 1 });
  });

  it('reads flags and a case list', () => {
    expect(parseEvalOptions(['--runs=5', '--pass-at=3', '--only=a,b', '--max-cost-usd=2', '--dump=out.json'], false)).toMatchObject({
      runs: 5,
      passAt: 3,
      only: ['a', 'b'],
      maxCostUsd: 2,
      dumpPath: 'out.json',
    });
  });

  it.each([
    [['--runs=0']],
    [['--runs=3', '--pass-at=4']],
    [['--unknown']],
    [['loose']],
    [['--save-baseline', '--only=a']],
    [['--max-cost-usd=abc']],
  ])('rejects %j', (argv) => {
    expect(() => parseEvalOptions(argv, false)).toThrow(InvalidEvalOptionError);
  });
});
