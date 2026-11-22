import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';

import { ANY_TOOL, EvalKind, type EvalCase } from './eval-case';

const GROUPED_DIGITS = /(?<=\d)[\s\u00a0\u202f](?=\d{3}(?!\d))/g;
const PERCENT = 100;

export interface CaseResult {
  caseId: string;
  calledKeys: readonly string[];
  answer: string;
  outcome: ChatOutcome;
  unverifiedNumbers: readonly string[];
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
  unverifiedNumbers: string[];
  fellBack: boolean;
}

export interface EvalSummary {
  cases: number;
  toolSelectionAccuracy: number;
  factAccuracy: number;
  hallucinatedNumbers: number;
  fallbacks: number;
  unknownAnsweredHonestly: number | null;
  failedCases: string[];
}

const normalize = (text: string): string => text.toLowerCase().replace(GROUPED_DIGITS, '');

const mentions = (answer: string, needle: string): boolean =>
  normalize(answer).includes(normalize(needle));

export const scoreCase = (testCase: EvalCase, result: CaseResult): CaseScore => {
  const allowed = new Set([...testCase.expectedTools, ...(testCase.allowedExtraTools ?? [])]);
  const anyAllowed = allowed.has(ANY_TOOL);
  const missingTools = testCase.expectedTools.filter((key) => !result.calledKeys.includes(key));
  const unexpectedTools = anyAllowed
    ? []
    : [...new Set(result.calledKeys)].filter((key) => !allowed.has(key));
  const missingFacts = testCase.mustContain
    .filter((alternatives) => !alternatives.some((option) => mentions(result.answer, option)))
    .map((alternatives) => alternatives.join(' | '));
  const forbiddenHits = (testCase.mustNotContain ?? []).filter((needle) =>
    mentions(result.answer, needle),
  );
  const fellBack = result.outcome === ChatOutcome.FALLBACK || result.outcome === ChatOutcome.FAILED;
  return {
    caseId: testCase.id,
    kind: testCase.kind,
    toolsOk: missingTools.length === 0 && unexpectedTools.length === 0,
    missingTools,
    unexpectedTools,
    factsOk: missingFacts.length === 0 && forbiddenHits.length === 0 && !fellBack,
    missingFacts,
    forbiddenHits,
    unverifiedNumbers: [...result.unverifiedNumbers],
    fellBack,
  };
};

const rate = (hits: number, total: number): number => (total === 0 ? 1 : hits / total);

export const summarize = (scores: readonly CaseScore[]): EvalSummary => {
  const unknown = scores.filter((score) => score.kind === EvalKind.UNKNOWN);
  return {
    cases: scores.length,
    toolSelectionAccuracy: rate(scores.filter((score) => score.toolsOk).length, scores.length),
    factAccuracy: rate(scores.filter((score) => score.factsOk).length, scores.length),
    hallucinatedNumbers: scores.filter((score) => score.unverifiedNumbers.length > 0).length,
    fallbacks: scores.filter((score) => score.fellBack).length,
    unknownAnsweredHonestly:
      unknown.length === 0
        ? null
        : rate(unknown.filter((score) => score.factsOk).length, unknown.length),
    failedCases: scores
      .filter((score) => !score.toolsOk || !score.factsOk || score.fellBack)
      .map((score) => score.caseId),
  };
};

export const asPercent = (value: number | null): string =>
  value === null ? 'n/a' : `${Math.round(value * PERCENT)}%`;
