export const BaselineSaveDecision = {
  NOT_REQUESTED: 'not_requested',
  SAVE: 'save',
  SKIPPED_CASES: 'skipped_cases',
  REGRESSIONS: 'regressions',
} as const;

export type BaselineSaveDecision = (typeof BaselineSaveDecision)[keyof typeof BaselineSaveDecision];

export interface BaselineSaveRequest {
  saveBaseline: boolean;
  forceBaseline: boolean;
  skippedCases: number;
  regressions: number;
}

export const decideBaselineSave = ({
  saveBaseline,
  forceBaseline,
  skippedCases,
  regressions,
}: BaselineSaveRequest): BaselineSaveDecision => {
  if (!saveBaseline) return BaselineSaveDecision.NOT_REQUESTED;
  if (skippedCases > 0) return BaselineSaveDecision.SKIPPED_CASES;
  if (regressions > 0 && !forceBaseline) return BaselineSaveDecision.REGRESSIONS;
  return BaselineSaveDecision.SAVE;
};

export const REGRESSIONS_NOT_SAVED_MESSAGE =
  'baseline not saved: the run has regressions against it; fix them, or pass --force-baseline to accept them on purpose';
