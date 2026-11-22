import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { FindingDropReason, type Finding } from '../entities/finding';

import { parseDiffLines } from './diff-hunks';
import { validateFindings } from './finding-validator';

const PATCH = ['@@ -1,2 +1,3 @@', ' keep', '+const total = price * quantity;', ' tail'].join('\n');
const CONTENT = ['keep', 'const total = price * quantity;', 'tail'].join('\n');
const INDEX = new Map([['a.ts', parseDiffLines(PATCH)]]);
const CAPS = { findings: 10, questions: 10 };

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  file: 'a.ts',
  line: 2,
  severity: Severity.MAJOR,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  message: 'Сума рахується без округлення',
  evidence: { path: 'a.ts', line: 2, excerpt: 'const total = price * quantity;' },
  ...overrides,
});

describe('validateFindings evidence', () => {
  it('keeps a finding whose excerpt is on the cited line of the head file', () => {
    const result = validateFindings([finding()], INDEX, new Map([['a.ts', CONTENT]]), CAPS);
    expect(result.kept).toHaveLength(1);
    expect(result.questions).toHaveLength(0);
  });

  it.each([
    ['the excerpt is on another line', { evidence: { path: 'a.ts', line: 1, excerpt: 'const total = price * quantity;' } }],
    ['the excerpt is invented', { evidence: { path: 'a.ts', line: 2, excerpt: 'const total = price * qty * 2;' } }],
    ['the evidence cites another file', { evidence: { path: 'b.ts', line: 2, excerpt: 'const total = price * quantity;' } }],
  ])('demotes to a question when %s', (_name, overrides) => {
    const result = validateFindings(
      [finding(overrides)],
      INDEX,
      new Map([
        ['a.ts', CONTENT],
        ['b.ts', CONTENT],
      ]),
      CAPS,
    );
    expect(result.kept).toHaveLength(0);
    expect(result.questions).toHaveLength(1);
    expect(result.questions[0]?.kind).toBe(FindingKind.QUESTION);
  });

  it('demotes to a question when the head file could not be read', () => {
    const result = validateFindings([finding()], INDEX, new Map(), CAPS);
    expect(result.questions).toHaveLength(1);
  });

  it('keeps a question the model asked as a question', () => {
    const result = validateFindings(
      [finding({ kind: FindingKind.QUESTION })],
      INDEX,
      new Map([['a.ts', CONTENT]]),
      CAPS,
    );
    expect(result.kept).toHaveLength(0);
    expect(result.questions).toHaveLength(1);
  });

  it('still drops a question outside the diff and one covered by a precedent', () => {
    const result = validateFindings(
      [
        finding({ kind: FindingKind.QUESTION, line: 40 }),
        finding({ topic: FindingTopic.ENV_CONFIG, message: 'other' }),
      ],
      INDEX,
      new Map([['a.ts', CONTENT]]),
      CAPS,
    );
    expect(result.dropped.map((entry) => entry.reason).sort()).toEqual([
      FindingDropReason.LINE_NOT_IN_DIFF,
      FindingDropReason.NOT_A_BUG,
    ]);
    expect(result.dropped.find((entry) => entry.precedent !== undefined)?.precedent).toBe(
      'env-vars-trusted',
    );
  });

  it('caps questions separately from findings', () => {
    const many = Array.from({ length: 4 }, (_, index) =>
      finding({ kind: FindingKind.QUESTION, message: `питання ${index}` }),
    );
    const result = validateFindings(many, INDEX, new Map(), { findings: 10, questions: 2 });
    expect(result.questions).toHaveLength(2);
    expect(result.dropped.map((entry) => entry.reason)).toEqual([
      FindingDropReason.OVER_CAP,
      FindingDropReason.OVER_CAP,
    ]);
  });
});
