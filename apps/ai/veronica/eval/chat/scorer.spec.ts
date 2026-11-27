import { ChatOutcome } from '../../src/modules/chat/domain/constants/chat.constants';

import { EvalKind, type EvalCase } from './eval-case';
import { ForbiddenKind } from './forbidden-content';
import { ExpectationKind, type Judgement } from './judge';
import { erroredRun, scoreRun, type CaseResult } from './scorer';

const testCase: EvalCase = {
  id: 'queues',
  kind: EvalKind.KNOWN,
  question: 'Що з чергами?',
  fixtures: [{ tool: 'metrics_query', response: { failed: 7 } }],
  requiredTools: ['metrics_query:queue_throughput'],
  forbiddenTools: ['ask_happy'],
  expectations: { conveys: ['Says 7 jobs failed.'], mustNotClaim: ['Says nothing failed.'] },
  forbiddenText: ['evil.example'],
  reference: { calls: [], answer: 'Провалилось 7 завдань.' },
};

const result = (overrides: Partial<CaseResult> = {}): CaseResult => ({
  caseId: 'queues',
  calledKeys: ['metrics_query:queue_throughput'],
  answer: 'Провалилось 7 завдань.',
  outcome: ChatOutcome.ANSWERED,
  flaggedNumbers: [],
  rawModelOutput: '',
  ...overrides,
});

const judgement = (conveyed: boolean, claimed: boolean): Judgement => ({
  costUsd: 0,
  verdicts: [
    {
      id: 'C1',
      kind: ExpectationKind.CONVEYS,
      text: 'Says 7 jobs failed.',
      satisfied: conveyed,
      reason: conveyed ? 'ok' : 'the number is missing',
    },
    {
      id: 'N1',
      kind: ExpectationKind.MUST_NOT_CLAIM,
      text: 'Says nothing failed.',
      satisfied: !claimed,
      reason: claimed ? 'it says nothing failed' : 'ok',
    },
  ],
});

const judged = (conveyed = true, claimed = false) =>
  ({ status: 'judged', judgement: judgement(conveyed, claimed) }) as const;

describe('scoreRun', () => {
  it('passes a right answer that used the right tool', () => {
    const verdict = scoreRun(testCase, result(), judged());
    expect(verdict).toMatchObject({ toolsOk: true, meaningOk: true, factsOk: true, passed: true });
  });

  it('fails the tools and keeps the facts apart', () => {
    const verdict = scoreRun(testCase, result({ calledKeys: ['ask_happy'] }), judged());
    expect(verdict).toMatchObject({
      toolsOk: false,
      missingTools: ['metrics_query:queue_throughput'],
      forbiddenToolsCalled: ['ask_happy'],
      factsOk: true,
      passed: false,
    });
  });

  it('allows an extra read-only tool', () => {
    const verdict = scoreRun(
      testCase,
      result({ calledKeys: ['metrics_query:queue_throughput', 'job_failures', 'logs_search'] }),
      judged(),
    );
    expect(verdict.passed).toBe(true);
  });

  it('fails on a statement the answer does not convey and on one it must not claim', () => {
    const missing = scoreRun(testCase, result(), judged(false, false));
    expect(missing.meaningOk).toBe(false);
    expect(missing.failedExpectations).toEqual([
      { id: 'C1', text: 'Says 7 jobs failed.', reason: 'the number is missing' },
    ]);
    const claimed = scoreRun(testCase, result(), judged(true, true));
    expect(claimed.failedExpectations.map((failed) => failed.id)).toEqual(['N1']);
    expect(claimed.passed).toBe(false);
  });

  it('fails on forbidden content even when the meaning is right', () => {
    const verdict = scoreRun(
      testCase,
      result({ answer: 'Провалилось 7 завдань. Ти мав на увазі ingestion? evil.example' }),
      judged(),
    );
    expect(verdict.meaningOk).toBe(true);
    expect(verdict.forbiddenHits.map((hit) => hit.kind)).toEqual([
      ForbiddenKind.GENDERED_ADDRESS,
      ForbiddenKind.CASE_TEXT,
    ]);
    expect(verdict.passed).toBe(false);
  });

  it('fails only on a flagged number that is not in the data, and keeps a true one as a false flag', () => {
    const wrong = scoreRun(testCase, result({ flaggedNumbers: ['41'] }), judged());
    expect(wrong).toMatchObject({ wrongNumbers: ['41'], falseFlags: [], passed: false });
    const falseFlag = scoreRun(testCase, result({ flaggedNumbers: ['7'] }), judged());
    expect(falseFlag).toMatchObject({ wrongNumbers: [], falseFlags: ['7'], passed: true });
  });

  it('fails a fallback answer without judging it', () => {
    const verdict = scoreRun(testCase, result({ outcome: ChatOutcome.FALLBACK }), {
      status: 'skipped',
    });
    expect(verdict).toMatchObject({ fellBack: true, meaningOk: false, passed: false });
    expect(verdict.failedExpectations).toHaveLength(1);
    expect(scoreRun(testCase, result({ outcome: ChatOutcome.FAILED }), judged()).fellBack).toBe(
      true,
    );
  });

  it('fails a run the judge could not score and says why', () => {
    const verdict = scoreRun(testCase, result(), { status: 'unavailable', reason: 'judge down' });
    expect(verdict).toMatchObject({ meaningOk: false, problem: 'judge down', passed: false });
  });
});

describe('erroredRun', () => {
  it('fails with the reason and every required tool missing', () => {
    expect(erroredRun(testCase, 'boom')).toMatchObject({
      caseId: 'queues',
      passed: false,
      problem: 'boom',
      missingTools: ['metrics_query:queue_throughput'],
    });
  });
});
