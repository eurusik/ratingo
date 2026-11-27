import type { EvalCase } from './eval-case';

const TEMPLATE_SEPARATOR = ':';

export interface ToolCheck {
  ok: boolean;
  missing: string[];
  forbiddenCalled: string[];
}

const isForbidden = (calledKey: string, forbidden: string): boolean =>
  calledKey === forbidden || calledKey.startsWith(`${forbidden}${TEMPLATE_SEPARATOR}`);

export const checkTools = (
  testCase: Pick<EvalCase, 'requiredTools' | 'forbiddenTools'>,
  calledKeys: readonly string[],
): ToolCheck => {
  const missing = testCase.requiredTools.filter((key) => !calledKeys.includes(key));
  const forbiddenCalled = [
    ...new Set(
      calledKeys.filter((called) =>
        (testCase.forbiddenTools ?? []).some((forbidden) => isForbidden(called, forbidden)),
      ),
    ),
  ];
  return { ok: missing.length === 0 && forbiddenCalled.length === 0, missing, forbiddenCalled };
};
