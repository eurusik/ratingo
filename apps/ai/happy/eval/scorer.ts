import type { ValidatedFinding } from '../src/modules/review/domain/entities/finding';

import { EvalKind, expectedLine, type EvalCase } from './eval-case';

const LINE_TOLERANCE = 2;

type LocatedFinding = Pick<ValidatedFinding, 'file' | 'line' | 'checkId'>;

export interface CaseResult {
  caseId: string;
  kind: EvalKind;
  selectedCheckIds: readonly string[];
  findings: readonly LocatedFinding[];
  questions: readonly LocatedFinding[];
}

interface CheckBreakdown {
  findings: number;
  falsePositives: number;
}

const NO_CHECK = 'none';

export interface CaseScore {
  caseId: string;
  kind: EvalKind;
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  protectedFalsePositives: number;
  unknownAsQuestion: number;
  unknownOverconfident: number;
  noiseQuestions: number;
  offTargetOnExpectedCheck: number;
  offTargetOnOtherCheck: number;
  offTargetOutsideChecks: number;
  byCheck: Record<string, CheckBreakdown>;
}

export interface EvalMetrics {
  precision: number | null;
  recall: number | null;
  falsePositives: number;
  protectedFalsePositives: number;
  unknownAsQuestionRate: number | null;
  noiseQuestions: number;
  offTargetOnExpectedCheck: number;
  offTargetOnOtherCheck: number;
  offTargetOutsideChecks: number;
  byCheck: Record<string, CheckBreakdown>;
  cases: number;
}

const near = (line: number, expected: number | null): boolean =>
  expected !== null && Math.abs(line - expected) <= LINE_TOLERANCE;

const emptyScore = (result: CaseResult): CaseScore => ({
  caseId: result.caseId,
  kind: result.kind,
  truePositives: 0,
  falsePositives: 0,
  falseNegatives: 0,
  protectedFalsePositives: 0,
  unknownAsQuestion: 0,
  unknownOverconfident: 0,
  noiseQuestions: 0,
  offTargetOnExpectedCheck: 0,
  offTargetOnOtherCheck: 0,
  offTargetOutsideChecks: 0,
  byCheck: {},
});

const offTargetFindings = (
  testCase: EvalCase,
  result: CaseResult,
  expected: number | null,
): LocatedFinding[] =>
  testCase.kind === EvalKind.POSITIVE
    ? result.findings.filter(
        (finding) => !(finding.file === testCase.path && near(finding.line, expected)),
      )
    : [...result.findings];

const breakdownByCheck = (
  findings: readonly LocatedFinding[],
  falsePositives: readonly LocatedFinding[],
  kind: EvalKind,
): Record<string, CheckBreakdown> => {
  const result: Record<string, CheckBreakdown> = {};
  const wrong = new Set(kind === EvalKind.POSITIVE ? falsePositives : findings);
  for (const finding of findings) {
    const key = finding.checkId ?? NO_CHECK;
    const entry = result[key] ?? { findings: 0, falsePositives: 0 };
    entry.findings += 1;
    entry.falsePositives += wrong.has(finding) ? 1 : 0;
    result[key] = entry;
  }
  return result;
};

const mergeBreakdowns = (scores: readonly CaseScore[]): Record<string, CheckBreakdown> => {
  const merged: Record<string, CheckBreakdown> = {};
  for (const score of scores) {
    for (const [key, value] of Object.entries(score.byCheck)) {
      const entry = merged[key] ?? { findings: 0, falsePositives: 0 };
      entry.findings += value.findings;
      entry.falsePositives += value.falsePositives;
      merged[key] = entry;
    }
  }
  return merged;
};

export const scoreCase = (testCase: EvalCase, result: CaseResult): CaseScore => {
  const score = emptyScore(result);
  const expected = expectedLine(testCase);
  const inFile = (entry: Pick<ValidatedFinding, 'file'>): boolean => entry.file === testCase.path;
  if (testCase.kind === EvalKind.POSITIVE) {
    const hits = result.findings.filter(
      (finding) => inFile(finding) && near(finding.line, expected),
    );
    score.truePositives = hits.length > 0 ? 1 : 0;
    score.falseNegatives = hits.length > 0 ? 0 : 1;
    score.falsePositives = result.findings.length - hits.length;
    score.noiseQuestions = result.questions.length;
  } else if (testCase.kind === EvalKind.PROTECTED_NEGATIVE) {
    score.falsePositives = result.findings.length;
    score.protectedFalsePositives = result.findings.length;
    score.noiseQuestions = result.questions.length;
  } else {
    score.unknownAsQuestion = result.questions.some(
      (question) => inFile(question) && near(question.line, expected),
    )
      ? 1
      : 0;
    score.unknownOverconfident = result.findings.length;
    score.falsePositives = result.findings.length;
  }
  const offTarget = offTargetFindings(testCase, result, expected);
  score.offTargetOnExpectedCheck = offTarget.filter(
    (finding) => finding.checkId !== null && finding.checkId === testCase.checkId,
  ).length;
  score.offTargetOnOtherCheck = offTarget.filter(
    (finding) =>
      finding.checkId !== null &&
      finding.checkId !== testCase.checkId &&
      result.selectedCheckIds.includes(finding.checkId),
  ).length;
  score.offTargetOutsideChecks = offTarget.filter((finding) => finding.checkId === null).length;
  score.byCheck = breakdownByCheck(result.findings, offTarget, testCase.kind);
  return score;
};

const ratio = (numerator: number, denominator: number): number | null =>
  denominator === 0 ? null : numerator / denominator;

export const summarize = (scores: readonly CaseScore[]): EvalMetrics => {
  const sum = (pick: (score: CaseScore) => number): number =>
    scores.reduce((total, score) => total + pick(score), 0);
  const truePositives = sum((score) => score.truePositives);
  const falsePositives = sum((score) => score.falsePositives);
  const unknownCases = scores.filter((score) => score.kind === EvalKind.UNKNOWN).length;
  return {
    precision: ratio(truePositives, truePositives + falsePositives),
    recall: ratio(truePositives, truePositives + sum((score) => score.falseNegatives)),
    falsePositives,
    protectedFalsePositives: sum((score) => score.protectedFalsePositives),
    unknownAsQuestionRate: ratio(
      sum((score) => score.unknownAsQuestion),
      unknownCases,
    ),
    noiseQuestions: sum((score) => score.noiseQuestions),
    offTargetOnExpectedCheck: sum((score) => score.offTargetOnExpectedCheck),
    offTargetOnOtherCheck: sum((score) => score.offTargetOnOtherCheck),
    offTargetOutsideChecks: sum((score) => score.offTargetOutsideChecks),
    byCheck: mergeBreakdowns(scores),
    cases: scores.length,
  };
};
