import { FindingKind, FindingTopic } from '../constants/finding-classification.constants';
import { FindingCategory, Severity } from '../constants/severity.constants';
import { FindingDropReason, type Finding } from '../entities/finding';

import { parseDiffLines } from './diff-hunks';
import { validateFindings } from './finding-validator';

const PATCH = ['@@ -1,2 +1,3 @@', ' keep', '+const total = price * quantity;', ' tail'].join('\n');
const CONTENT = ['keep', 'const total = price * quantity;', 'tail'].join('\n');
const INDEX = new Map([['a.ts', parseDiffLines(PATCH)]]);
const FILES = new Map([['a.ts', CONTENT]]);

const finding = (overrides: Partial<Finding> = {}): Finding => ({
  file: 'a.ts',
  line: 2,
  severity: Severity.CRITICAL,
  category: FindingCategory.CORRECTNESS,
  topic: FindingTopic.LOGIC,
  kind: FindingKind.FINDING,
  checkId: null,
  message: 'Помилка',
  evidence: { path: 'a.ts', line: 2, excerpt: 'const total = price * quantity;' },
  ...overrides,
});

describe('validateFindings with checks', () => {
  const selectedChecks = [{ id: 'race', severityCap: Severity.MINOR }];

  it('drops a finding that names a check that was not selected', () => {
    const result = validateFindings([finding({ checkId: 'ghost' })], INDEX, FILES, {
      selectedChecks,
    });
    expect(result.kept).toHaveLength(0);
    expect(result.dropped[0]?.reason).toBe(FindingDropReason.UNSELECTED_CHECK);
  });

  it('keeps general findings and lowers severity to the cap of the check it follows', () => {
    const result = validateFindings(
      [finding({ checkId: 'race' }), finding({ checkId: null, message: 'інше' })],
      INDEX,
      FILES,
      { selectedChecks },
    );
    const bySeverity = Object.fromEntries(
      result.kept.map((entry) => [entry.checkId ?? 'general', entry.severity]),
    );
    expect(bySeverity).toEqual({ general: Severity.CRITICAL, race: Severity.MINOR });
  });

  it('never raises a severity that is already below the cap', () => {
    const result = validateFindings(
      [finding({ checkId: 'race', severity: Severity.NIT })],
      INDEX,
      FILES,
      { selectedChecks },
    );
    expect(result.kept[0]?.severity).toBe(Severity.NIT);
  });
});
