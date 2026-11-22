import type { ValidatedFinding } from '../src/modules/review/domain/entities/finding';

import { EvalKind, expectedLine, type EvalCase } from './eval-case';

const LINE_TOLERANCE = 2;

export interface CaseResult {
  caseId: string;
  kind: EvalKind;
  findings: readonly Pick<ValidatedFinding, 'file' | 'line'>[];
  questions: readonly Pick<ValidatedFinding, 'file' | 'line'>[];
}

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
}

export interface EvalMetrics {
  precision: number | null;
  recall: number | null;
  falsePositives: number;
  protectedFalsePositives: number;
  unknownAsQuestionRate: number | null;
  noiseQuestions: number;
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
});

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
    cases: scores.length,
  };
};
