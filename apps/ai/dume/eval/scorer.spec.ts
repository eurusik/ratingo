import { AnswerSupport, AssumptionOrigin, CitationFailure, type VerifiedAnswer } from '../src/modules/investigation/domain/entities/investigation-answer';
import { InvestigationStatus, type InvestigationOutcome } from '../src/modules/investigation/domain/entities/investigation-outcome';
import { SnapshotFailure } from '../src/modules/investigation/domain/errors/investigation.errors';
import { CaseKind, type EvalCase } from './eval-case';
import { scoreRun, type MeaningCheck } from './scorer';

const testCase: EvalCase = {
  id: 'case',
  kind: CaseKind.ANSWERABLE,
  question: 'q',
  evidence: [],
  requiredFiles: ['a.ts'],
  conveys: ['c'],
  mustNotClaim: ['n'],
  forbiddenText: ['CANARY'],
  reference: { answer: 'r', claims: [], unknowns: [] },
};

const answerWith = (overrides: Partial<VerifiedAnswer> = {}): VerifiedAnswer => ({
  answer: 'Відповідь.',
  facts: [{ text: 'fact', citations: [{ path: 'a.ts', startLine: 1, endLine: 2 }] }],
  assumptions: [],
  unknowns: [],
  support: AnswerSupport.SUPPORTED,
  ...overrides,
});

const outcomeWith = (answer: VerifiedAnswer | null, overrides: Partial<InvestigationOutcome> = {}): InvestigationOutcome => ({
  status: answer === null ? InvestigationStatus.UNANSWERED : InvestigationStatus.ANSWERED,
  ref: 'main',
  commit: 'sha',
  answer,
  runId: 'run',
  stopReason: 'end',
  turns: 3,
  costUsd: 0.1,
  toolCalls: {},
  pathsRead: [],
  snapshotFailure: null,
  ...overrides,
});

const judged = (satisfied: boolean): MeaningCheck => ({
  status: 'judged',
  judgement: {
    costUsd: 0.01,
    verdicts: [{ id: 'C1', kind: 'conveys', text: 'c', satisfied, reason: 'because' }],
  },
});

describe('scoreRun', () => {
  it('passes a verified answer that cites the required file and means the right thing', () => {
    const verdict = scoreRun(testCase, outcomeWith(answerWith()), judged(true));

    expect(verdict).toMatchObject({ passed: true, failures: [], problem: null, turns: 3, costUsd: 0.1, judgeCostUsd: 0.01, verifiedFacts: 1 });
  });

  it('fails when the meaning check fails and says which statement', () => {
    const verdict = scoreRun(testCase, outcomeWith(answerWith()), judged(false));

    expect(verdict.passed).toBe(false);
    expect(verdict.failures[0]).toContain('conveys not met');
  });

  it('fails when a required file is not cited with a verified citation', () => {
    const verdict = scoreRun({ ...testCase, requiredFiles: ['b.ts'] }, outcomeWith(answerWith()), judged(true));

    expect(verdict.failures).toEqual(['required files not cited with a verified citation: b.ts']);
  });

  it('fails on a citation to a file or lines that do not exist but not on one that was merely not read', () => {
    const demoted = (failure: CitationFailure) =>
      answerWith({
        assumptions: [
          { text: 'claim', origin: AssumptionOrigin.UNVERIFIED_CLAIM, problems: [{ citation: null, failure }] },
        ],
      });

    const fabricated = scoreRun(testCase, outcomeWith(demoted(CitationFailure.FILE_NOT_IN_SNAPSHOT)), judged(true));
    const unread = scoreRun(testCase, outcomeWith(demoted(CitationFailure.NOT_READ_IN_THIS_RUN)), judged(true));

    expect(fabricated.failures.join()).toContain('do not exist');
    expect(fabricated.fabricatedCitations).toBe(1);
    expect(unread.passed).toBe(true);
    expect(unread.unverifiedClaims).toBe(1);
  });

  it('fails on forbidden text and on a gendered self reference', () => {
    const forbidden = scoreRun(testCase, outcomeWith(answerWith({ answer: 'canary-7 says CANARY' })), judged(true));
    const gendered = scoreRun(testCase, outcomeWith(answerWith({ answer: 'Я знайшов це в коді.' })), judged(true));
    const neutral = scoreRun(testCase, outcomeWith(answerWith({ answer: 'У коді знайдено це.' })), judged(true));
    const otherSubject = scoreRun(testCase, outcomeWith(answerWith({ answer: 'Тест знайшов помилку, яку перевірив код.' })), judged(true));
    const clauseStart = scoreRun(testCase, outcomeWith(answerWith({ answer: 'Це так. Знайшов у файлі.' })), judged(true));

    expect(forbidden.failures.join()).toContain('forbidden text');
    expect(gendered.failures.join()).toContain('gendered');
    expect(neutral.passed).toBe(true);
    expect(otherSubject.passed).toBe(true);
    expect(clauseStart.failures.join()).toContain('gendered');
  });

  it('fails an unanswered run without calling it unscorable', () => {
    const verdict = scoreRun(testCase, outcomeWith(null, { stopReason: 'budget_exceeded' }), { status: 'skipped' });

    expect(verdict).toMatchObject({ passed: false, problem: null, turns: 3 });
    expect(verdict.failures[0]).toContain('budget_exceeded');
  });

  it('reports a missing snapshot and a judge outage as problems, not as failures of the agent', () => {
    const noSnapshot = scoreRun(
      testCase,
      outcomeWith(null, { status: InvestigationStatus.SNAPSHOT_UNAVAILABLE, snapshotFailure: SnapshotFailure.RATE_LIMITED }),
      { status: 'skipped' },
    );
    const noJudge = scoreRun(testCase, outcomeWith(answerWith()), { status: 'unavailable', reason: 'timeout' });

    expect(noSnapshot.problem).toContain('rate_limited');
    expect(noJudge).toMatchObject({ passed: false, problem: 'timeout' });
  });

  it('requires an unknown question to list what is unknown and does not demand facts', () => {
    const unknownCase: EvalCase = { ...testCase, kind: CaseKind.UNKNOWN, requiredFiles: [] };
    const honest = scoreRun(unknownCase, outcomeWith(answerWith({ facts: [], unknowns: ['not in code'], support: AnswerSupport.NO_CLAIMS })), judged(true));
    const silent = scoreRun(unknownCase, outcomeWith(answerWith({ facts: [], unknowns: [], support: AnswerSupport.NO_CLAIMS })), judged(true));

    expect(honest).toMatchObject({ passed: true, answeredHonestlyUnknown: true });
    expect(silent.passed).toBe(false);
  });

  it('requires at least one verified fact on a question the code can answer', () => {
    const verdict = scoreRun({ ...testCase, requiredFiles: [] }, outcomeWith(answerWith({ facts: [], support: AnswerSupport.NO_CLAIMS })), judged(true));

    expect(verdict.failures).toContain('no verified fact in the answer');
  });
});
