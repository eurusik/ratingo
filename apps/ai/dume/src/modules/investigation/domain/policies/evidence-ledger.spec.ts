import fc from 'fast-check';

import { EvidenceLedger } from './evidence-ledger';

const range = fc
  .tuple(fc.integer({ min: 1, max: 200 }), fc.integer({ min: 0, max: 40 }))
  .map(([start, length]) => ({ start, end: start + length }));

describe('EvidenceLedger', () => {
  it('covers a range only when the union of recorded ranges contains it', () => {
    fc.assert(
      fc.property(fc.array(range, { maxLength: 8 }), range, (recorded, asked) => {
        const ledger = new EvidenceLedger();
        recorded.forEach((entry) => ledger.record('a.ts', entry.start, entry.end));
        const lines = new Set(recorded.flatMap((entry) => Array.from({ length: entry.end - entry.start + 1 }, (_, offset) => entry.start + offset)));
        const expected = Array.from({ length: asked.end - asked.start + 1 }, (_, offset) => asked.start + offset).every((line) => lines.has(line));
        expect(ledger.covers('a.ts', asked.start, asked.end)).toBe(expected);
      }),
      { numRuns: 500 },
    );
  });

  it('joins touching ranges and keeps paths apart', () => {
    const ledger = new EvidenceLedger();
    ledger.record('a.ts', 1, 10);
    ledger.record('a.ts', 11, 20);
    ledger.record('b.ts', 5, 6);

    expect(ledger.covers('a.ts', 5, 18)).toBe(true);
    expect(ledger.covers('a.ts', 5, 21)).toBe(false);
    expect(ledger.covers('b.ts', 1, 6)).toBe(false);
    expect(ledger.covers('c.ts', 1, 1)).toBe(false);
    expect(ledger.pathsRead()).toEqual(['a.ts', 'b.ts']);
  });

  it('ignores an inverted range', () => {
    const ledger = new EvidenceLedger();
    ledger.record('a.ts', 9, 3);

    expect(ledger.covers('a.ts', 3, 9)).toBe(false);
  });
});
