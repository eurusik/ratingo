import fc from 'fast-check';

import { SearchMode, compileSearchPattern } from './search-pattern';

const regex = (pattern: string, ignoreCase = false) =>
  compileSearchPattern({ pattern, mode: SearchMode.REGEX, ignoreCase });
const text = (pattern: string, ignoreCase = true) =>
  compileSearchPattern({ pattern, mode: SearchMode.TEXT, ignoreCase });

const matches = (result: ReturnType<typeof regex>, line: string): boolean => {
  if (!result.ok) throw new Error(result.message);
  return result.matcher.test(line);
};

describe('compileSearchPattern in text mode', () => {
  it('finds a substring regardless of regex characters', () => {
    expect(matches(text('worker.on('), "    worker.on('failed', (job) => {")).toBe(true);
    expect(matches(text('a+b'), 'a+b')).toBe(true);
    expect(matches(text('a+b'), 'aab')).toBe(false);
  });

  it('ignores case only when asked', () => {
    expect(matches(text('SIGTERM', true), 'process.on("sigterm")')).toBe(true);
    expect(matches(text('SIGTERM', false), 'process.on("sigterm")')).toBe(false);
  });

  it('treats every non-empty string of bounded length as a valid text pattern', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 200 }), (pattern) => {
        expect(text(pattern).ok).toBe(true);
      }),
    );
  });

  it('rejects an empty or over-long pattern', () => {
    expect(text('').ok).toBe(false);
    expect(text('x'.repeat(201)).ok).toBe(false);
  });
});

describe('compileSearchPattern in regex mode', () => {
  it('accepts the plain subset', () => {
    expect(matches(regex('^\\s*export (const|function) \\w+'), 'export function foo() {')).toBe(
      true,
    );
    expect(matches(regex('cron:\\s*"[^"]+"'), 'cron: "0 3 * * *"')).toBe(true);
    expect(matches(regex('a{2,4}b'), 'xaaab')).toBe(true);
    expect(matches(regex('foo.*?bar'), 'foo and bar')).toBe(true);
  });

  it.each([
    ['nested repeat', '(a+)+$'],
    ['repeated group', '(ab)*c'],
    ['repeated alternation group', '(a|b)+'],
    ['backreference', '(a)\\1'],
    ['lookahead', 'a(?=b)'],
    ['lookbehind', '(?<=a)b'],
    ['named group', '(?<name>a)'],
    ['unicode escape', '\\u0041'],
    ['hex escape', '\\x41'],
    ['huge repeat', 'a{1,5000}'],
    ['three open-ended repeats', 'a*b*c*'],
    ['repeat with nothing before it', '*a'],
    ['double repeat', 'a**'],
    ['unterminated class', '[abc'],
    ['unbalanced group', '(a'],
    ['stray close', 'a)'],
    ['trailing backslash', 'a\\'],
    ['malformed braces', 'a{x}'],
    ['deep nesting', '((((a))))'],
  ])('rejects %s', (_name, pattern) => {
    expect(regex(pattern).ok).toBe(false);
  });

  it('never throws and always yields a usable matcher or a message for any input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (pattern) => {
        const result = regex(pattern);
        if (result.ok) {
          expect(typeof result.matcher.test('sample line of code')).toBe('boolean');
        } else {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('finishes quickly on a hostile line for every accepted pattern shape', () => {
    const hostile = `${'a'.repeat(599)}!`;
    const accepted = ['a*a*b', '.*.*x', '\\w+\\w+$', 'a+.*c'];
    for (const pattern of accepted) {
      const result = regex(pattern);
      expect(result.ok).toBe(true);
      const started = Date.now();
      if (result.ok) result.matcher.test(hostile);
      expect(Date.now() - started).toBeLessThan(5_000);
    }
  });

  it('limits the line length a regex is applied to', () => {
    const result = regex('a');
    expect(result.ok && result.matcher.maxLineChars).toBe(600);
  });
});
