import * as fc from 'fast-check';

import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { FindingDropReason, type Finding } from '../entities/finding';

import { parseDiffLines, type DiffLines } from './diff-hunks';
import { fingerprintFinding } from './finding-fingerprint';
import { validateFindings, type DiffIndex, type EvidenceFiles } from './finding-validator';

const PATCH = ['@@ -10,4 +10,5 @@', ' keep', '-old', '+new one', '+new two', ' tail'].join('\n');

const EVIDENCE_LINE = 'const value = 1;';
const EVIDENCE_FILES: EvidenceFiles = new Map(
  ['a.ts', 'b.ts', 'c.ts', 'missing.ts'].map((path) => [
    path,
    Array.from({ length: 40 }, () => EVIDENCE_LINE).join('\n'),
  ]),
);

const caps = (limit: number) => ({ findings: limit, questions: limit });

const withEvidence = (file: string, line: number) => ({
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  evidence: { path: file, line, excerpt: EVIDENCE_LINE },
});

const findingArb: fc.Arbitrary<Finding> = fc
  .record({
    file: fc.constantFrom('a.ts', 'b.ts', 'c.ts', 'missing.ts'),
    line: fc.integer({ min: 1, max: 30 }),
    severity: fc.constantFrom(...Object.values(Severity)),
    category: fc.constantFrom(...Object.values(FindingCategory)),
    message: fc.string({ minLength: 0, maxLength: 80 }),
  })
  .map((finding) => ({ ...finding, ...withEvidence(finding.file, finding.line) }));

const indexOf = (patch: string): DiffIndex =>
  new Map<string, DiffLines>([
    ['a.ts', parseDiffLines(patch)],
    ['b.ts', parseDiffLines(patch)],
    ['c.ts', parseDiffLines(patch)],
  ]);

describe('parseDiffLines', () => {
  it('numbers context and added lines on the new side and skips removed lines', () => {
    const lines = parseDiffLines(PATCH);
    expect([...lines.commentable]).toEqual([10, 11, 12, 13]);
    expect([...lines.added]).toEqual([11, 12]);
  });

  it('handles several hunks and the no-newline marker', () => {
    const lines = parseDiffLines(
      [
        '@@ -1,2 +1,2 @@',
        ' a',
        '+b',
        '\\ No newline at end of file',
        '@@ -20,1 +21,2 @@',
        ' x',
        '+y',
      ].join('\n'),
    );
    expect([...lines.commentable]).toEqual([1, 2, 21, 22]);
  });

  it('returns nothing for text without hunks', () => {
    expect(parseDiffLines('Binary files differ').commentable.size).toBe(0);
  });
});

describe('validateFindings', () => {
  const index = indexOf(PATCH);

  it('keeps only findings whose file and line are inside the diff', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 30 }), (findings) => {
        const { kept } = validateFindings(findings, index, EVIDENCE_FILES, caps(1000));
        return kept.every(
          (finding) =>
            index.get(finding.file)?.commentable.has(finding.line) === true &&
            finding.message.trim().length > 0,
        );
      }),
    );
  });

  it('accounts for every input finding exactly once', () => {
    fc.assert(
      fc.property(
        fc.array(findingArb, { maxLength: 30 }),
        fc.integer({ min: 0, max: 10 }),
        (findings, cap) => {
          const { kept, questions, dropped } = validateFindings(
            findings,
            index,
            EVIDENCE_FILES,
            caps(cap),
          );
          return (
            kept.length + questions.length + dropped.length === findings.length &&
            kept.length <= cap
          );
        },
      ),
    );
  });

  it('never keeps two findings with the same fingerprint', () => {
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 30 }), (findings) => {
        const prints = validateFindings(findings, index, EVIDENCE_FILES, caps(1000)).kept.map(
          (f) => f.fingerprint,
        );
        return new Set(prints).size === prints.length;
      }),
    );
  });

  it('orders kept findings by severity first', () => {
    const order = Object.values(Severity);
    fc.assert(
      fc.property(fc.array(findingArb, { maxLength: 30 }), (findings) => {
        const ranks = validateFindings(findings, index, EVIDENCE_FILES, caps(1000)).kept.map((f) =>
          order.indexOf(f.severity),
        );
        return ranks.every((rank, i) => i === 0 || (ranks[i - 1] ?? 0) <= rank);
      }),
    );
  });

  it('drops with a specific reason', () => {
    const base = {
      severity: Severity.MAJOR,
      category: FindingCategory.CORRECTNESS,
      message: 'broken',
    };
    const result = validateFindings(
      [
        { ...base, file: 'zzz.ts', line: 11, ...withEvidence('zzz.ts', 11) },
        { ...base, file: 'a.ts', line: 99, ...withEvidence('a.ts', 99) },
        { ...base, file: 'a.ts', line: 11, message: '   ', ...withEvidence('a.ts', 11) },
        { ...base, file: 'a.ts', line: 11, ...withEvidence('a.ts', 11) },
        { ...base, file: 'a.ts', line: 12, message: 'BROKEN', ...withEvidence('a.ts', 12) },
      ],
      index,
      EVIDENCE_FILES,
    );
    expect(result.kept).toHaveLength(1);
    expect(result.dropped.map((entry) => entry.reason).sort()).toEqual(
      [
        FindingDropReason.DUPLICATE,
        FindingDropReason.EMPTY_MESSAGE,
        FindingDropReason.FILE_NOT_IN_DIFF,
        FindingDropReason.LINE_NOT_IN_DIFF,
      ].sort(),
    );
  });
});

describe('fingerprintFinding', () => {
  const base = { file: 'a.ts', category: FindingCategory.TESTS, message: 'Missing test' };

  it('ignores case, whitespace and line moves', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 60 }), (message) => {
        const left = fingerprintFinding({ ...base, message });
        const right = fingerprintFinding({ ...base, message: `  ${message.toUpperCase()}  ` });
        return message.toUpperCase().toLowerCase() !== message.toLowerCase() || left === right;
      }),
    );
  });

  it('changes with the file or the category', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.string({ minLength: 1, maxLength: 12 }),
        (left, right) =>
          left === right ||
          fingerprintFinding({ ...base, file: left }) !==
            fingerprintFinding({ ...base, file: right }),
      ),
    );
    expect(fingerprintFinding(base)).not.toBe(
      fingerprintFinding({ ...base, category: FindingCategory.SECURITY }),
    );
  });

  it('is a fixed-width hex string', () => {
    fc.assert(
      fc.property(fc.string(), (message) =>
        /^[0-9a-f]{16}$/.test(fingerprintFinding({ ...base, message })),
      ),
    );
  });
});
