import {
  summarizeCalibration,
  type CalibrationItem,
  type CalibrationReport,
  type CalibrationVerdict,
} from './calibration';
import { mapWithLimit } from './concurrency';
import type { EvalCase } from './eval-case';
import { judgeInputOf, judgementPassed, type JudgePort } from './judge';

const judgeItem = async (
  item: CalibrationItem,
  testCase: EvalCase,
  judge: JudgePort,
): Promise<CalibrationVerdict> => {
  try {
    const judgement = await judge.judge(judgeInputOf(testCase, item.answer));
    return {
      item,
      judgedGood: judgementPassed(judgement),
      reasons: judgement.verdicts
        .filter((verdict) => !verdict.satisfied)
        .map((verdict) => `${verdict.id}: ${verdict.reason}`),
      costUsd: judgement.costUsd,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown error';
    return { item, judgedGood: null, reasons: [reason], costUsd: 0 };
  }
};

export const measureJudgeAgreement = async (
  items: readonly CalibrationItem[],
  cases: readonly EvalCase[],
  judge: JudgePort,
  concurrency: number,
): Promise<CalibrationReport> => {
  const byId = new Map(cases.map((testCase) => [testCase.id, testCase]));
  const verdicts = await mapWithLimit(items, concurrency, async (item) => {
    const testCase = byId.get(item.caseId);
    if (testCase === undefined) {
      return { item, judgedGood: null, reasons: [`unknown case ${item.caseId}`], costUsd: 0 };
    }
    return judgeItem(item, testCase, judge);
  });
  return summarizeCalibration(verdicts);
};
