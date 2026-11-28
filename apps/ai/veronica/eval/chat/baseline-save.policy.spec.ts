import { BaselineSaveDecision, decideBaselineSave } from './baseline-save.policy';

const request = (changes: Partial<Parameters<typeof decideBaselineSave>[0]> = {}) =>
  decideBaselineSave({
    saveBaseline: true,
    forceBaseline: false,
    skippedCases: 0,
    regressions: 0,
    ...changes,
  });

describe('decideBaselineSave', () => {
  it('saves a clean full run when asked', () => {
    expect(request()).toBe(BaselineSaveDecision.SAVE);
  });

  it('does nothing when saving was not asked for, whatever the run looks like', () => {
    expect(request({ saveBaseline: false, regressions: 3 })).toBe(
      BaselineSaveDecision.NOT_REQUESTED,
    );
  });

  it('refuses to save a run with regressions', () => {
    expect(request({ regressions: 1 })).toBe(BaselineSaveDecision.REGRESSIONS);
  });

  it('saves a run with regressions only when forced', () => {
    expect(request({ regressions: 1, forceBaseline: true })).toBe(BaselineSaveDecision.SAVE);
  });

  it('refuses a run with skipped cases even when forced', () => {
    expect(request({ skippedCases: 2, forceBaseline: true, regressions: 1 })).toBe(
      BaselineSaveDecision.SKIPPED_CASES,
    );
  });
});
