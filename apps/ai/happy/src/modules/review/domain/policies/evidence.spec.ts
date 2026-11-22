import * as fc from 'fast-check';

import { evidenceHolds } from './evidence';

const lineText = fc.string({ minLength: 0, maxLength: 60 }).filter((text) => !text.includes('\n'));

describe('evidenceHolds', () => {
  it('accepts an excerpt that is a long enough slice of the cited line', () => {
    fc.assert(
      fc.property(
        fc.array(lineText, { minLength: 1, maxLength: 8 }),
        fc.nat(7),
        fc.nat(30),
        fc.nat(30),
        (lines, lineIndex, from, length) => {
          const index = lineIndex % lines.length;
          const line = lines[index] ?? '';
          const excerpt = line.slice(from, from + length);
          const significant = excerpt.replace(/\s+/g, '').length;
          fc.pre(significant >= 8);
          const collapsed = excerpt.replace(/\s+/g, ' ').trim();
          fc.pre(line.replace(/\s+/g, ' ').includes(collapsed));
          return evidenceHolds({ path: 'a.ts', line: index + 1, excerpt }, lines.join('\n'));
        },
      ),
    );
  });

  it('rejects an excerpt that appears only on another line', () => {
    const content = ['const first = loadFirstValue();', 'const second = loadSecondValue();'].join(
      '\n',
    );
    expect(
      evidenceHolds({ path: 'a.ts', line: 1, excerpt: 'loadSecondValue()' }, content),
    ).toBe(false);
    expect(evidenceHolds({ path: 'a.ts', line: 2, excerpt: 'loadSecondValue()' }, content)).toBe(
      true,
    );
  });

  it('requires the whole line when the excerpt is shorter than the minimum', () => {
    const content = 'if (a) {\n  return;\n}';
    expect(evidenceHolds({ path: 'a.ts', line: 2, excerpt: 'return;' }, content)).toBe(true);
    expect(evidenceHolds({ path: 'a.ts', line: 1, excerpt: 'if' }, content)).toBe(false);
    expect(evidenceHolds({ path: 'a.ts', line: 1, excerpt: 'if (a) {' }, content)).toBe(true);
  });

  it('never holds for a missing file, a line past the end or an empty excerpt', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), fc.integer({ min: 1, max: 5 }), (excerpt, line) =>
        evidenceHolds({ path: 'a.ts', line, excerpt }, undefined) === false,
      ),
    );
    expect(evidenceHolds({ path: 'a.ts', line: 9, excerpt: 'const value = 1;' }, 'one')).toBe(
      false,
    );
    expect(evidenceHolds({ path: 'a.ts', line: 1, excerpt: '   ' }, '   ')).toBe(false);
  });

  it('ignores differences in whitespace and carriage returns', () => {
    expect(
      evidenceHolds(
        { path: 'a.ts', line: 1, excerpt: 'const   value =  compute(1)' },
        'const value = compute(1);\r\nnext',
      ),
    ).toBe(true);
  });
});
