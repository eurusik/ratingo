import { z } from 'zod';

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

export const JUDGE_RESPONSE_NAME = 'expectation_verdicts';

export const judgeResponseSchema = z.object({
  verdicts: z.array(
    z.object({
      id: z.string(),
      holds: z.boolean(),
      reason: z.string(),
    }),
  ),
});

export type JudgeResponse = z.infer<typeof judgeResponseSchema>;

export const verdictsFromResponse = (
  expectations: readonly JudgedExpectation[],
  response: JudgeResponse,
): ExpectationVerdict[] =>
  expectations.map((expectation) => {
    const given = response.verdicts.find((verdict) => verdict.id === expectation.id);
    return given === undefined
      ? { ...expectation, satisfied: false, reason: MISSING_VERDICT_REASON }
      : {
          ...expectation,
          satisfied: isSatisfied(expectation.kind, given.holds),
          reason: given.reason,
        };
  });

export const JUDGE_SYSTEM_PROMPT = [
  'You grade one answer written by an operations assistant for a small Ukrainian-language streaming-discovery service.',
  'You receive the owner’s question, optional earlier conversation, a list of statements to check, a reference answer and the answer to grade.',
  '',
  'For every statement decide one thing: does the answer assert it, directly or by unmistakable implication? Answer holds=true or holds=false.',
  '',
  'Rules for deciding:',
  '- Judge meaning only. Synonyms, paraphrase, word order, tone, formatting and the choice between “помилка” and “збій” never matter.',
  '- Numbers may be written as digits or as Ukrainian words, with or without thousand separators or a decimal comma. Dates and times may be written in any format, with or without the weekday, as long as they denote the same moment.',
  '- A statement holds only when the answer actually makes it. A hedge that removes the claim (“can’t tell”, “possibly”) means holds=false, unless the statement itself is about uncertainty or missing data.',
  '- A statement that is partly right (right number, wrong subject; right subject, wrong number) holds=false.',
  '- Mentioning a claim only to deny it, to refuse it or to say that it is unsupported does not count as asserting it.',
  '- Extra correct detail, extra caveats and a different order are fine; they never make a statement false. Never penalize an answer for length or style.',
  '- Check only the listed statements. Do not use your own knowledge of the service and do not check numbers against anything except the statements.',
  '- The reference answer is one acceptable wording, not the only one. Use it to understand the statements, never to demand its wording.',
  '- Be strict about substance and lenient about wording.',
  '',
  'Reply with JSON only: {"verdicts":[{"id":"C1","holds":true,"reason":"one short sentence"}]}. Include every id exactly once. The reason is one line in English that quotes the part of the answer you relied on, or says what is missing.',
].join('\n');

const turnLabel = (turn: ConversationTurn): string =>
  turn.role === TurnRole.USER ? 'Owner' : 'Assistant';

const statementLines = (expectations: readonly JudgedExpectation[]): string =>
  expectations
    .map((expectation) =>
      expectation.kind === ExpectationKind.CONVEYS
        ? `${expectation.id}. The answer conveys: ${expectation.text}`
        : `${expectation.id}. The answer claims: ${expectation.text}`,
    )
    .join('\n');

export const buildJudgePrompt = (input: JudgeInput): string =>
  [
    ...(input.history.length === 0
      ? []
      : [
          'Earlier conversation:',
          ...input.history.map((turn) => `${turnLabel(turn)}: ${turn.text}`),
          '',
        ]),
    `Owner’s question: ${input.question}`,
    '',
    'Statements to check:',
    statementLines(input.expectations),
    '',
    `Reference answer (one acceptable wording): ${input.referenceAnswer}`,
    '',
    'Answer to grade:',
    input.answer,
  ].join('\n');
