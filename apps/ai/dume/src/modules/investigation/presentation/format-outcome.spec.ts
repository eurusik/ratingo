import {
  AnswerSupport,
  AssumptionOrigin,
  CitationFailure,
  type VerifiedAnswer,
} from '../domain/entities/investigation-answer';
import {
  InvestigationStatus,
  type InvestigationOutcome,
} from '../domain/entities/investigation-outcome';
import { formatOutcome, plainLine } from './format-outcome';

const outcomeWith = (answer: VerifiedAnswer): InvestigationOutcome => ({
  status: InvestigationStatus.ANSWERED,
  ref: 'main',
  commit: 'a'.repeat(40),
  answer,
  runId: 'run',
  stopReason: 'end',
  stopDetail: null,
  turns: 3,
  costUsd: 0.0123,
  toolCalls: {},
  pathsRead: [],
  snapshotFailure: null,
});

describe('plainLine', () => {
  it('removes terminal control sequences and flattens line breaks', () => {
    expect(plainLine('red \u001b[31mtext\u001b[0m\nsupport: supported\r\n\u009b2J done')).toBe(
      'red [31mtext [0m support: supported 2J done',
    );
  });
});

describe('formatOutcome', () => {
  const answer: VerifiedAnswer = {
    answer: 'Відповідь.\nsupport: supported',
    facts: [
      { text: 'a fact', citations: [{ path: 'a.ts', startLine: 3, endLine: 5 }] },
      { text: 'one line', citations: [{ path: 'b.ts', startLine: 7, endLine: 7 }] },
    ],
    assumptions: [
      {
        text: 'maybe',
        origin: AssumptionOrigin.UNVERIFIED_CLAIM,
        problems: [{ citation: null, failure: CitationFailure.NO_CITATION }],
      },
    ],
    unknowns: ['unknown \u001b[2Jthing'],
    support: AnswerSupport.PARTLY_SUPPORTED,
  };

  it('prints the answer, the cited lines, the unverified claims and the run footer', () => {
    const text = formatOutcome(outcomeWith(answer));

    expect(text).toContain('a.ts:3-5');
    expect(text).toContain('b.ts:7');
    expect(text).toContain('[unverified claim: no_citation] maybe');
    expect(text).toContain('turns: 3  cost: $0.0123  stop: end');
  });

  it('cannot be made to fake a line of its own or to carry escape sequences', () => {
    const text = formatOutcome(outcomeWith(answer));

    expect(text.split('\n').filter((line) => line.startsWith('support:'))).toEqual([
      'support: partly_supported',
    ]);
    expect(text).not.toContain('\u001b');
  });

  it('says why a run has no answer or no snapshot', () => {
    const none = {
      ...outcomeWith(answer),
      answer: null,
      stopReason: 'model_error',
      stopDetail: 'client, HTTP 400',
    };

    expect(formatOutcome(none)).toContain('stop: model_error (client, HTTP 400)');
    expect(
      formatOutcome({
        ...none,
        status: InvestigationStatus.SNAPSHOT_UNAVAILABLE,
        snapshotFailure: 'rate_limited',
      }),
    ).toContain('rate_limited');
  });
});
