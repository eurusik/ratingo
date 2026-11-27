import fc from 'fast-check';

import { InProcessPatternSession } from '../../infrastructure/adapters/in-process.pattern-matcher-adapter';
import { SearchMode, compileSearchPattern } from './search-pattern';

const regex = (pattern: string, ignoreCase = false) =>
  compileSearchPattern({ pattern, mode: SearchMode.REGEX, ignoreCase });
const text = (pattern: string, ignoreCase = true) =>
  compileSearchPattern({ pattern, mode: SearchMode.TEXT, ignoreCase });

const matches = async (result: ReturnType<typeof regex>, line: string): Promise<boolean> => {
  if (!result.ok) throw new Error(result.message);
  const outcome = await new InProcessPatternSession(result.pattern).match([line]);
  return !outcome.timedOut && outcome.indices.length === 1;
};

describe('compileSearchPattern in text mode', () => {
  it('finds a substring regardless of regex characters', async () => {
    expect(await matches(text('worker.on('), "    worker.on('failed', (job) => {")).toBe(true);
    expect(await matches(text('a+b'), 'a+b')).toBe(true);
    expect(await matches(text('a+b'), 'aab')).toBe(false);
  });

  it('ignores case only when asked', async () => {
    expect(await matches(text('SIGTERM', true), 'process.on("sigterm")')).toBe(true);
    expect(await matches(text('SIGTERM', false), 'process.on("sigterm")')).toBe(false);
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
  it('accepts the plain subset', async () => {
    expect(
      await matches(regex('^\\s*export (const|function) \\w+'), 'export function foo() {'),
    ).toBe(true);
    expect(await matches(regex('cron:\\s*"[^"]+"'), 'cron: "0 3 * * *"')).toBe(true);
    expect(await matches(regex('a{2,4}b'), 'xaaab')).toBe(true);
    expect(await matches(regex('foo.*?bar'), 'foo and bar')).toBe(true);
    expect(await matches(regex('colou?r'), 'the color')).toBe(true);
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
    ['an empty class that hides a repeated group', '[]|(?:a+)+b]'],
    ['many optional repeats', `${'.?'.repeat(45)}${'.'.repeat(45)}Z`],
    ['many stacked bounded repeats', `${'.{0,200}'.repeat(10)}Z`],
  ])('rejects %s', (_name, pattern) => {
    expect(regex(pattern).ok).toBe(false);
  });

  it('closes a character class on the first closing bracket exactly as JavaScript does', async () => {
    expect(regex('[]a').ok).toBe(true);
    expect(await matches(regex('[^]'), 'x')).toBe(true);
    expect(await matches(regex('[]'), 'x')).toBe(false);
  });

  it('counts every kind of repeat against one budget', () => {
    expect(regex('.?'.repeat(16)).ok).toBe(true);
    expect(regex('.?'.repeat(17)).ok).toBe(false);
    expect(regex('.{0,200}.{0,200}').ok).toBe(true);
    expect(regex('.{0,200}.{0,200}.{0,200}').ok).toBe(false);
    expect(regex('.*.*').ok).toBe(true);
    expect(regex('.*.*.*').ok).toBe(false);
  });

  it('never throws and always yields a pattern or a message for any input', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), (pattern) => {
        const result = regex(pattern);
        if (result.ok) {
          expect(() => new RegExp(result.pattern.source, result.pattern.flags)).not.toThrow();
        } else {
          expect(result.message.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 1000 },
    );
  });

  describe('generated patterns from the accepted grammar', () => {
    const atom = fc.constantFrom('a', '.', '\\w', '\\d', '[ab]', '[^b]', 'Z', '\\s');
    const repeat = fc.constantFrom(
      '',
      '',
      '*',
      '+',
      '?',
      '*?',
      '+?',
      '{0,3}',
      '{2}',
      '{1,50}',
      '{0,200}',
      '{3,}',
    );
    const piece = fc.tuple(atom, repeat).map(([base, suffix]) => `${base}${suffix}`);
    const pattern = fc
      .array(piece, { minLength: 1, maxLength: 12 })
      .map((pieces) => pieces.join(''));
    const hostileLines = [`${'a'.repeat(299)}!`, 'a'.repeat(300), `${'ab'.repeat(150)}`];
    const SLOWEST_ACCEPTED_MS = 250;

    it('finish quickly on 300-character hostile lines', async () => {
      let accepted = 0;
      let slowest = 0;
      await fc.assert(
        fc.asyncProperty(pattern, async (source) => {
          const compiled = regex(source);
          if (!compiled.ok) return;
          accepted += 1;
          for (const line of hostileLines) {
            const started = Date.now();
            await new InProcessPatternSession(compiled.pattern).match([line]);
            slowest = Math.max(slowest, Date.now() - started);
          }
        }),
        { numRuns: 300 },
      );

      expect(accepted).toBeGreaterThan(20);
      expect(slowest).toBeLessThan(SLOWEST_ACCEPTED_MS);
    });

    it('are rejected whenever three of their repeats are open-ended', () => {
      const openEnded = new Set(['*', '+', '*?', '+?', '{3,}']);
      fc.assert(
        fc.property(fc.array(fc.tuple(atom, repeat), { minLength: 3, maxLength: 12 }), (pieces) => {
          fc.pre(pieces.filter(([, suffix]) => openEnded.has(suffix)).length >= 3);

          expect(regex(pieces.map(([base, suffix]) => `${base}${suffix}`).join('')).ok).toBe(false);
        }),
        { numRuns: 300 },
      );
    });
  });

  it('limits the line length a regex is applied to', () => {
    const result = regex('a');
    expect(result.ok && result.pattern.maxLineChars).toBe(300);
  });
});
