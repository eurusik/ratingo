import { EVAL_CASES } from './cases';
import { EvalKind, baseLinesOf, changedRange, expectedLine, renderPatch } from './eval-case';

describe('eval cases', () => {
  it('has at least 10 cases with unique ids and all three kinds', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EVAL_CASES.map((testCase) => testCase.id)).size).toBe(EVAL_CASES.length);
    for (const kind of Object.values(EvalKind)) {
      expect(EVAL_CASES.some((testCase) => testCase.kind === kind)).toBe(true);
    }
  });

  it('points every expectation at a line that exists', () => {
    for (const testCase of EVAL_CASES) {
      if (testCase.kind === EvalKind.PROTECTED_NEGATIVE) {
        expect(testCase.expectation).toBeUndefined();
      } else {
        expect(expectedLine(testCase)).not.toBeNull();
      }
    }
  });

  it('renders a patch whose added lines match the file', () => {
    for (const testCase of EVAL_CASES) {
      const patch = renderPatch(testCase);
      const added = patch.split('\n').filter((line) => line.startsWith('+')).length;
      const range = changedRange(testCase);
      expect(added).toBe(range === null ? testCase.lines.length : range.end - range.start + 1);
      expect((baseLinesOf(testCase) ?? []).length + added).toBeGreaterThanOrEqual(
        testCase.lines.length,
      );
    }
  });

  it('models every case as a modified file, except new migrations which are added files', () => {
    for (const testCase of EVAL_CASES) {
      const range = changedRange(testCase);
      const isNewMigration =
        testCase.changed === undefined && /drizzle[^/]*\/\d{4}_.*\.sql$/.test(testCase.path);
      expect({ id: testCase.id, resolved: range !== null || isNewMigration }).toEqual({
        id: testCase.id,
        resolved: true,
      });
      expect(Object.keys(testCase.extraFiles ?? {})).not.toContain(testCase.path);
      if (testCase.expectation !== undefined && range !== null) {
        const line = expectedLine(testCase) ?? 0;
        expect({ id: testCase.id, inside: line >= range.start && line <= range.end }).toEqual({
          id: testCase.id,
          inside: true,
        });
      }
    }
  });

  it('keeps comments out of the code so the repo rule is not scored as noise', () => {
    const COMMENT = /^\s*(\/\/|\/\*|\*\s|\*\/|--(?!>| squawk-ignore))/;
    for (const testCase of EVAL_CASES) {
      const files = [testCase.lines, ...Object.values(testCase.extraFiles ?? {})];
      for (const lines of files) {
        const comment = lines.find((line) => COMMENT.test(line));
        expect({ id: testCase.id, comment }).toEqual({ id: testCase.id, comment: undefined });
      }
    }
  });
});
