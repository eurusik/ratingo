import {
  TurnRole,
  type ConversationTurn,
} from '../../src/modules/chat/domain/entities/conversation-turn';

import { plainText } from './answer-text';
import type { EvalCase } from './eval-case';

export const ExpectationKind = {
  CONVEYS: 'conveys',
  MUST_NOT_CLAIM: 'mustNotClaim',
} as const;
export type ExpectationKind = (typeof ExpectationKind)[keyof typeof ExpectationKind];

export interface JudgedExpectation {
  id: string;
  kind: ExpectationKind;
  text: string;
}

export interface JudgeInput {
  question: string;
  history: readonly ConversationTurn[];
  referenceAnswer: string;
  expectations: readonly JudgedExpectation[];
  answer: string;
}

export interface ExpectationVerdict extends JudgedExpectation {
  satisfied: boolean;
  reason: string;
}

export interface Judgement {
  verdicts: readonly ExpectationVerdict[];
  costUsd: number;
}

export interface JudgePort {
  judge(input: JudgeInput): Promise<Judgement>;
}

export class JudgeUnavailableError extends Error {
  constructor(reason: string) {
    super(`The judge could not score the answer: ${reason}`);
    this.name = 'JudgeUnavailableError';
  }
}

const CONVEYS_PREFIX = 'C';
const MUST_NOT_CLAIM_PREFIX = 'N';
const MISSING_VERDICT_REASON = 'the judge returned no verdict for this expectation';

export const judgedExpectationsOf = (testCase: EvalCase): JudgedExpectation[] => [
  ...testCase.expectations.conveys.map((text, index) => ({
    id: `${CONVEYS_PREFIX}${index + 1}`,
    kind: ExpectationKind.CONVEYS,
    text,
  })),
  ...(testCase.expectations.mustNotClaim ?? []).map((text, index) => ({
    id: `${MUST_NOT_CLAIM_PREFIX}${index + 1}`,
    kind: ExpectationKind.MUST_NOT_CLAIM,
    text,
  })),
];

export const judgeInputOf = (testCase: EvalCase, answer: string): JudgeInput => ({
  question: testCase.question,
  history: testCase.history ?? [],
  referenceAnswer: testCase.reference.answer,
  expectations: judgedExpectationsOf(testCase),
  answer: plainText(answer),
});

export const isSatisfied = (kind: ExpectationKind, holds: boolean): boolean =>
  kind === ExpectationKind.CONVEYS ? holds : !holds;

export const judgementPassed = (judgement: Judgement): boolean =>
  judgement.verdicts.every((verdict) => verdict.satisfied);

export const failedVerdicts = (judgement: Judgement): ExpectationVerdict[] =>
  judgement.verdicts.filter((verdict) => !verdict.satisfied);

export interface RawVerdict {
  id: string;
  holds: boolean;
  reason: string;
}

export const verdictsFromRaw = (
  expectations: readonly JudgedExpectation[],
  rawVerdicts: readonly RawVerdict[],
): ExpectationVerdict[] =>
  expectations.map((expectation) => {
    const given = rawVerdicts.find((verdict) => verdict.id === expectation.id);
    return given === undefined
      ? { ...expectation, satisfied: false, reason: MISSING_VERDICT_REASON }
      : {
          ...expectation,
          satisfied: isSatisfied(expectation.kind, given.holds),
          reason: given.reason,
        };
  });
