import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';
import {
  knownNumbers,
  unverifiedNumbers,
} from '../../src/modules/chat/domain/policies/numbers-guard.policy';

import type { EvalCase, EvalKind } from './eval-case';
import { findForbiddenContent, type ForbiddenHit } from './forbidden-content';
import { failedVerdicts, type Judgement } from './judge';
import { checkTools } from './tool-check';

export interface CaseResult {
  caseId: string;
  calledKeys: readonly string[];
  answer: string;
  outcome: ChatOutcome;
  flaggedNumbers: readonly string[];
  rawModelOutput: string;
}

export type MeaningCheck =
  | { status: 'judged'; judgement: Judgement }
  | { status: 'skipped' }
  | { status: 'unavailable'; reason: string };

interface FailedExpectation {
  id: string;
  text: string;
  reason: string;
}

export interface RunVerdict {
  caseId: string;
  kind: EvalKind;
  answer: string;
  calledKeys: readonly string[];
  toolsOk: boolean;
  missingTools: readonly string[];
  forbiddenToolsCalled: readonly string[];
  meaningOk: boolean;
  failedExpectations: readonly FailedExpectation[];
  forbiddenHits: readonly ForbiddenHit[];
  flaggedNumbers: readonly string[];
  wrongNumbers: readonly string[];
  falseFlags: readonly string[];
  fellBack: boolean;
  problem: string | null;
  factsOk: boolean;
  passed: boolean;
}

const SKIPPED_REASON = 'the model fell back to the raw snapshot, so there is no answer to judge';

const fellBackOn = (outcome: ChatOutcome): boolean =>
  outcome === ChatOutcome.FALLBACK || outcome === ChatOutcome.FAILED;

const failedExpectationsOf = (meaning: MeaningCheck): FailedExpectation[] => {
  if (meaning.status === 'judged') {
    return failedVerdicts(meaning.judgement).map(({ id, text, reason }) => ({ id, text, reason }));
  }
  return [];
};

const problemOf = (meaning: MeaningCheck): string | null =>
  meaning.status === 'unavailable' ? meaning.reason : null;

export const scoreRun = (
  testCase: EvalCase,
  result: CaseResult,
  meaning: MeaningCheck,
): RunVerdict => {
  const tools = checkTools(testCase, result.calledKeys);
  const failedExpectations = failedExpectationsOf(meaning);
  const meaningOk = meaning.status === 'judged' && failedExpectations.length === 0;
  const forbiddenHits = findForbiddenContent(result.answer, testCase.forbiddenText);
  const truth = knownNumbers([testCase.reference.answer, JSON.stringify(testCase.fixtures)]);
  const isTrue = (number: string): boolean => unverifiedNumbers(number, truth).length === 0;
  const wrongNumbers = result.flaggedNumbers.filter((number) => !isTrue(number));
  const fellBack = fellBackOn(result.outcome);
  const factsOk = meaningOk && forbiddenHits.length === 0 && wrongNumbers.length === 0 && !fellBack;
  return {
    caseId: testCase.id,
    kind: testCase.kind,
    answer: result.answer,
    calledKeys: result.calledKeys,
    toolsOk: tools.ok,
    missingTools: tools.missing,
    forbiddenToolsCalled: tools.forbiddenCalled,
    meaningOk,
    failedExpectations: fellBack
      ? [{ id: '-', text: 'an answer', reason: SKIPPED_REASON }]
      : failedExpectations,
    forbiddenHits,
    flaggedNumbers: [...result.flaggedNumbers],
    wrongNumbers,
    falseFlags: result.flaggedNumbers.filter(isTrue),
    fellBack,
    problem: problemOf(meaning),
    factsOk,
    passed: tools.ok && factsOk,
  };
};

export const erroredRun = (testCase: EvalCase, reason: string): RunVerdict => ({
  caseId: testCase.id,
  kind: testCase.kind,
  answer: '',
  calledKeys: [],
  toolsOk: false,
  missingTools: testCase.requiredTools,
  forbiddenToolsCalled: [],
  meaningOk: false,
  failedExpectations: [],
  forbiddenHits: [],
  flaggedNumbers: [],
  wrongNumbers: [],
  falseFlags: [],
  fellBack: false,
  problem: reason,
  factsOk: false,
  passed: false,
});
