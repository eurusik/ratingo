import { EVAL_CASES } from './cases';
import { EvalKind, expectedLine, renderPatch } from './eval-case';

describe('eval cases', () => {
  it('has 10 to 15 cases with unique ids and all three kinds', () => {
    expect(EVAL_CASES.length).toBeGreaterThanOrEqual(10);
    expect(EVAL_CASES.length).toBeLessThanOrEqual(15);
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
      const patch = renderPatch(testCase.lines);
      expect(patch.split('\n')).toHaveLength(testCase.lines.length + 1);
    }
  });
});
