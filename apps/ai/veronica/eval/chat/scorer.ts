import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';
import {
  knownNumbers,
  unverifiedNumbers,
} from '../../src/modules/chat/domain/policies/numbers-guard.policy';

import { ANY_TOOL, EvalKind, type EvalCase, type Expectation } from './eval-case';

const GROUPED_DIGITS = /(?<=\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g;
const PERCENT = 100;

export interface CaseResult {
  caseId: string;
  calledKeys: readonly string[];
  answer: string;
  outcome: ChatOutcome;
  flaggedNumbers: readonly string[];
  rawModelOutput: string;
}

export interface CaseScore {
  caseId: string;
  kind: EvalKind;
  toolsOk: boolean;
  missingTools: string[];
  unexpectedTools: string[];
  factsOk: boolean;
  missingFacts: string[];
  forbiddenHits: string[];
  flaggedNumbers: string[];
  wrongNumbers: string[];
  falseFlags: string[];
  fellBack: boolean;
}

export interface EvalSummary {
  cases: number;
  toolSelectionAccuracy: number;
  factAccuracy: number;
  answersWithFlags: number;
  flaggedNumbers: number;
  wrongNumbers: number;
  falseFlagRate: number | null;
  fallbacks: number;
  unknownAnsweredHonestly: number | null;
  failedCases: string[];
}

const APOSTROPHES = /['’`]/g;
const MODIFIER_APOSTROPHE = 'ʼ';

const normalize = (text: string): string =>
  text.toLowerCase().replace(GROUPED_DIGITS, '').replace(APOSTROPHES, MODIFIER_APOSTROPHE);

const mentions = (answer: string, needle: Expectation): boolean =>
  typeof needle === 'string'
    ? normalize(answer).includes(normalize(needle))
    : needle.test(normalize(answer));

const labelOf = (needle: Expectation): string =>
  typeof needle === 'string' ? needle : `/${needle.source}/`;

export const scoreCase = (testCase: EvalCase, result: CaseResult): CaseScore => {
  const allowed = new Set([...testCase.expectedTools, ...(testCase.allowedExtraTools ?? [])]);
  const anyAllowed = allowed.has(ANY_TOOL);
  const missingTools = testCase.expectedTools.filter((key) => !result.calledKeys.includes(key));
  const unexpectedTools = anyAllowed
    ? []
    : [...new Set(result.calledKeys)].filter((key) => !allowed.has(key));
  const missingFacts = testCase.mustContain
    .filter((alternatives) => !alternatives.some((option) => mentions(result.answer, option)))
    .map((alternatives) => alternatives.map(labelOf).join(' | '));
  const forbiddenHits = (testCase.mustNotContain ?? [])
    .filter((needle) => mentions(result.answer, needle))
    .map(labelOf);
  const fellBack = result.outcome === ChatOutcome.FALLBACK || result.outcome === ChatOutcome.FAILED;
  const truth = knownNumbers([testCase.reference.answer, JSON.stringify(testCase.fixtures)]);
  const isTrue = (number: string): boolean => unverifiedNumbers(number, truth).length === 0;
  return {
    caseId: testCase.id,
    kind: testCase.kind,
    toolsOk: missingTools.length === 0 && unexpectedTools.length === 0,
    missingTools,
    unexpectedTools,
    factsOk: missingFacts.length === 0 && forbiddenHits.length === 0 && !fellBack,
    missingFacts,
    forbiddenHits,
    flaggedNumbers: [...result.flaggedNumbers],
    wrongNumbers: result.flaggedNumbers.filter((number) => !isTrue(number)),
    falseFlags: result.flaggedNumbers.filter(isTrue),
    fellBack,
  };
};

const rate = (hits: number, total: number): number => (total === 0 ? 1 : hits / total);

const count = (
  scores: readonly CaseScore[],
  pick: (score: CaseScore) => readonly string[],
): number => scores.reduce((total, score) => total + pick(score).length, 0);

const falseFlagRate = (scores: readonly CaseScore[]): number | null => {
  const flagged = count(scores, (score) => score.flaggedNumbers);
  return flagged === 0 ? null : count(scores, (score) => score.falseFlags) / flagged;
};

export const summarize = (scores: readonly CaseScore[]): EvalSummary => {
  const unknown = scores.filter((score) => score.kind === EvalKind.UNKNOWN);
  return {
    cases: scores.length,
    toolSelectionAccuracy: rate(scores.filter((score) => score.toolsOk).length, scores.length),
    factAccuracy: rate(scores.filter((score) => score.factsOk).length, scores.length),
    answersWithFlags: scores.filter((score) => score.flaggedNumbers.length > 0).length,
    flaggedNumbers: count(scores, (score) => score.flaggedNumbers),
    wrongNumbers: count(scores, (score) => score.wrongNumbers),
    falseFlagRate: falseFlagRate(scores),
    fallbacks: scores.filter((score) => score.fellBack).length,
    unknownAnsweredHonestly:
      unknown.length === 0
        ? null
        : rate(unknown.filter((score) => score.factsOk).length, unknown.length),
    failedCases: scores
      .filter(
        (score) =>
          !score.toolsOk || !score.factsOk || score.fellBack || score.wrongNumbers.length > 0,
      )
      .map((score) => score.caseId),
  };
};

export const asPercent = (value: number | null): string =>
  value === null ? 'n/a' : `${Math.round(value * PERCENT)}%`;
