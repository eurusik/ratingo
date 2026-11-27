import { SearchMode, type CompiledPattern } from '../../domain/policies/search-pattern';
import { WorkerPatternMatcher } from './worker.pattern-matcher-adapter';

const regexPattern = (source: string, flags = ''): CompiledPattern => ({
  mode: SearchMode.REGEX,
  source,
  flags,
  maxLineChars: 300,
});

const textPattern = (source: string, flags = ''): CompiledPattern => ({
  mode: SearchMode.TEXT,
  source,
  flags,
  maxLineChars: Infinity,
});

const CATASTROPHIC = '(a+)+b';
const CATASTROPHIC_LINE = `${'a'.repeat(40)}!`;

describe('WorkerPatternMatcher', () => {
  const matcher = new WorkerPatternMatcher();

  it('returns the indices of matching lines for a regex', async () => {
    const session = matcher.open(regexPattern('^foo\\d+$', 'i'));

    const outcome = await session.match(['foo1', 'bar', 'FOO22', 'foo'], 2_000);
    await session.close();

    expect(outcome).toEqual({ timedOut: false, indices: [0, 2] });
  });

  it('serves several calls from one worker', async () => {
    const session = matcher.open(regexPattern('x'));

    const first = await session.match(['x', 'y'], 2_000);
    const second = await session.match(['y', 'x'], 2_000);
    await session.close();

    expect([first, second]).toEqual([
      { timedOut: false, indices: [0] },
      { timedOut: false, indices: [1] },
    ]);
  });

  it('kills a worker stuck in catastrophic backtracking and reports a timeout', async () => {
    const session = matcher.open(regexPattern(CATASTROPHIC));
    const started = Date.now();

    const outcome = await session.match([CATASTROPHIC_LINE], 300);
    const afterwards = await session.match(['ab'], 2_000);
    await session.close();

    expect(outcome).toEqual({ timedOut: true });
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(afterwards).toEqual({ timedOut: true });
  });

  it('does not start a worker when no time is left', async () => {
    const session = matcher.open(regexPattern('x'));

    await expect(session.match(['x'], 0)).resolves.toEqual({ timedOut: true });
    await session.close();
  });

  it('matches text in process, with or without case', async () => {
    const insensitive = matcher.open(textPattern('SIGTERM', 'i'));
    const sensitive = matcher.open(textPattern('SIGTERM'));

    await expect(insensitive.match(['on sigterm', 'none'], 1_000)).resolves.toEqual({
      timedOut: false,
      indices: [0],
    });
    await expect(sensitive.match(['on sigterm'], 1_000)).resolves.toEqual({
      timedOut: false,
      indices: [],
    });
  });
});
