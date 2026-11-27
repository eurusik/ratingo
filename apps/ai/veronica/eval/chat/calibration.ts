import type { EvalCase } from './eval-case';
import { judgeInputOf, judgementPassed, type JudgePort } from './judge';
import { mapWithLimit } from './concurrency';

const MIN_JUDGE_AGREEMENT = 0.9;

export const CalibrationSource = {
  PAST_RUN: 'past-run',
  WRITTEN: 'written',
} as const;
export type CalibrationSource = (typeof CalibrationSource)[keyof typeof CalibrationSource];

export interface CalibrationItem {
  id: string;
  caseId: string;
  source: CalibrationSource;
  meaningGood: boolean;
  contentViolation?: boolean;
  note: string;
  answer: string;
}

export interface CalibrationVerdict {
  item: CalibrationItem;
  judgedGood: boolean | null;
  reasons: readonly string[];
  costUsd: number;
}

export interface CalibrationReport {
  items: number;
  agreed: number;
  agreement: number;
  falsePasses: CalibrationVerdict[];
  falseFails: CalibrationVerdict[];
  unscorable: CalibrationVerdict[];
  costUsd: number;
  trustworthy: boolean;
}

export const summarizeCalibration = (
  verdicts: readonly CalibrationVerdict[],
): CalibrationReport => {
  const agreed = verdicts.filter((verdict) => verdict.judgedGood === verdict.item.meaningGood);
  const agreement = verdicts.length === 0 ? 1 : agreed.length / verdicts.length;
  return {
    items: verdicts.length,
    agreed: agreed.length,
    agreement,
    falsePasses: verdicts.filter(
      (verdict) => verdict.judgedGood === true && !verdict.item.meaningGood,
    ),
    falseFails: verdicts.filter(
      (verdict) => verdict.judgedGood === false && verdict.item.meaningGood,
    ),
    unscorable: verdicts.filter((verdict) => verdict.judgedGood === null),
    costUsd: verdicts.reduce((total, verdict) => total + verdict.costUsd, 0),
    trustworthy: agreement >= MIN_JUDGE_AGREEMENT,
  };
};

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
      reasons: judgement.verdicts.filter((v) => !v.satisfied).map((v) => `${v.id}: ${v.reason}`),
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
