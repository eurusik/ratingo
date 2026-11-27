import fc from 'fast-check';

import { CitationLimits } from '../constants/investigation.constants';
import type { CodeSnapshot, SnapshotFile } from '../entities/code-snapshot';
import {
  AnswerSupport,
  AssumptionOrigin,
  CitationFailure,
  type Citation,
  type InvestigationDraft,
} from '../entities/investigation-answer';
import { verifyAnswer } from './answer-verifier';
import { EvidenceLedger } from './evidence-ledger';
import { RuntimeEvidenceLedger } from './runtime-evidence-ledger';

const FILES: readonly SnapshotFile[] = [
  { path: 'apps/api/a.ts', bytes: 100, lineCount: 100 },
  { path: 'apps/api/b.ts', bytes: 10, lineCount: 10 },
];

const snapshot: Pick<CodeSnapshot, 'fileAt'> = {
  fileAt: (path) => FILES.find((file) => file.path === path),
};

const ledgerReading = (...ranges: [string, number, number][]): EvidenceLedger => {
  const ledger = new EvidenceLedger();
  ranges.forEach(([path, start, end]) => ledger.record(path, start, end));
  return ledger;
};

const draftWith = (
  ...claims: { text: string; citations: Citation[]; evidence?: string[] }[]
): InvestigationDraft => ({
  answer: 'short answer',
  claims: claims.map((claim) => ({ ...claim, evidence: claim.evidence ?? [] })),
  assumptions: [],
  unknowns: [],
});

const cite = (path: string, startLine: number, endLine: number): Citation => ({
  path,
  startLine,
  endLine,
});

describe('verifyAnswer', () => {
  it('keeps a claim as a fact when every citation exists and was read in this run', () => {
    const verified = verifyAnswer(
      draftWith({ text: 'it retries', citations: [cite('apps/api/a.ts', 10, 20)] }),
      snapshot,
      ledgerReading(['apps/api/a.ts', 1, 50]),
    );

    expect(verified.facts).toEqual([
      { text: 'it retries', citations: [cite('apps/api/a.ts', 10, 20)], evidence: [] },
    ]);
    expect(verified.assumptions).toEqual([]);
    expect(verified.support).toBe(AnswerSupport.SUPPORTED);
  });

  it.each([
    ['a missing file', cite('apps/api/missing.ts', 1, 2), CitationFailure.FILE_NOT_IN_SNAPSHOT],
    ['lines past the end', cite('apps/api/b.ts', 5, 11), CitationFailure.LINES_OUT_OF_RANGE],
    ['an inverted range', cite('apps/api/a.ts', 9, 3), CitationFailure.LINES_OUT_OF_RANGE],
    ['line zero', cite('apps/api/a.ts', 0, 3), CitationFailure.LINES_OUT_OF_RANGE],
    ['a fractional line', cite('apps/api/a.ts', 1.5, 3), CitationFailure.LINES_OUT_OF_RANGE],
    ['a parent path', cite('apps/../etc/passwd', 1, 1), CitationFailure.INVALID_PATH],
    ['a range nobody read', cite('apps/api/a.ts', 60, 70), CitationFailure.NOT_READ_IN_THIS_RUN],
    [
      'a range only partly read',
      cite('apps/api/a.ts', 40, 60),
      CitationFailure.NOT_READ_IN_THIS_RUN,
    ],
    ['a range that is too large', cite('apps/api/a.ts', 1, 100), CitationFailure.RANGE_TOO_LARGE],
  ])(
    'moves a claim with %s to the assumptions and never to the facts',
    (_name, citation, failure) => {
      const verified = verifyAnswer(
        draftWith({ text: 'it retries', citations: [citation] }),
        snapshot,
        ledgerReading(['apps/api/a.ts', 1, 50], ['apps/api/b.ts', 1, 10]),
      );

      expect(verified.facts).toEqual([]);
      expect(verified.assumptions).toHaveLength(1);
      expect(verified.assumptions[0]).toMatchObject({
        text: 'it retries',
        origin: AssumptionOrigin.UNVERIFIED_CLAIM,
        problems: [{ failure }],
      });
      expect(verified.support).toBe(AnswerSupport.UNSUPPORTED);
    },
  );

  it('demotes a claim without any citation', () => {
    const verified = verifyAnswer(
      draftWith({ text: 'trust me', citations: [] }),
      snapshot,
      new EvidenceLedger(),
    );

    expect(verified.facts).toEqual([]);
    expect(verified.assumptions[0]?.problems).toEqual([
      { citation: null, failure: CitationFailure.NO_CITATION },
    ]);
  });

  it('demotes the whole claim when one of several citations fails', () => {
    const verified = verifyAnswer(
      draftWith({
        text: 'two places',
        citations: [cite('apps/api/a.ts', 1, 5), cite('apps/api/b.ts', 1, 5)],
      }),
      snapshot,
      ledgerReading(['apps/api/a.ts', 1, 5]),
    );

    expect(verified.facts).toEqual([]);
    expect(verified.assumptions[0]?.problems).toHaveLength(1);
  });

  it('normalizes cited paths and reports partial support', () => {
    const verified = verifyAnswer(
      draftWith(
        { text: 'good', citations: [cite('./apps/api/a.ts', 1, 5)] },
        { text: 'bad', citations: [cite('apps/api/a.ts', 70, 75)] },
      ),
      snapshot,
      ledgerReading(['apps/api/a.ts', 1, 5]),
    );

    expect(verified.facts[0]?.citations).toEqual([cite('apps/api/a.ts', 1, 5)]);
    expect(verified.support).toBe(AnswerSupport.PARTLY_SUPPORTED);
  });

  it('keeps stated assumptions and unknowns and reports no claims for an honest unknown', () => {
    const verified = verifyAnswer(
      {
        answer: 'The code does not say.',
        claims: [],
        assumptions: ['maybe a cron'],
        unknowns: ['the value is set elsewhere'],
      },
      snapshot,
      new EvidenceLedger(),
    );

    expect(verified.support).toBe(AnswerSupport.NO_CLAIMS);
    expect(verified.assumptions).toEqual([
      { text: 'maybe a cron', origin: AssumptionOrigin.STATED_BY_MODEL, problems: [] },
    ]);
    expect(verified.unknowns).toEqual(['the value is set elsewhere']);
  });

  it('never loses a claim and never lets an unread range become a fact', () => {
    const citation = fc.record({
      path: fc.constantFrom('apps/api/a.ts', 'apps/api/b.ts', 'apps/api/c.ts', '../x'),
      startLine: fc.integer({ min: -2, max: 120 }),
      endLine: fc.integer({ min: -2, max: 120 }),
    });
    const range = fc.tuple(
      fc.constantFrom('apps/api/a.ts', 'apps/api/b.ts'),
      fc.integer({ min: 1, max: 100 }),
      fc.integer({ min: 1, max: 100 }),
    );
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            text: fc.string({ minLength: 1 }),
            citations: fc.array(citation, { maxLength: CitationLimits.MAX_CITATIONS_PER_CLAIM }),
          }),
          { maxLength: 8 },
        ),
        fc.array(range, { maxLength: 6 }),
        (claims, reads) => {
          const ledger = ledgerReading(...reads);
          const verified = verifyAnswer(draftWith(...claims), snapshot, ledger);
          const demoted = verified.assumptions.filter(
            (entry) => entry.origin === AssumptionOrigin.UNVERIFIED_CLAIM,
          );

          expect(verified.facts.length + demoted.length).toBe(claims.length);
          for (const fact of verified.facts) {
            expect(fact.citations.length).toBeGreaterThan(0);
            for (const entry of fact.citations) {
              expect(ledger.covers(entry.path, entry.startLine, entry.endLine)).toBe(true);
              expect(snapshot.fileAt(entry.path)).toBeDefined();
              expect(entry.endLine).toBeLessThanOrEqual(
                snapshot.fileAt(entry.path)?.lineCount ?? 0,
              );
            }
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

describe('verifyAnswer with runtime evidence', () => {
  const shown = (...refs: string[]): RuntimeEvidenceLedger => {
    const runtime = new RuntimeEvidenceLedger();
    refs.forEach((ref) =>
      runtime.record({ ref, tool: ref.split('#')[0] as string, summary: `row ${ref}` }),
    );
    return runtime;
  };

  it('keeps a claim as a fact when every runtime row it cites was shown, and carries the rows', () => {
    const verified = verifyAnswer(
      draftWith({ text: 'timeouts today', citations: [], evidence: ['logs_search#1.2'] }),
      snapshot,
      new EvidenceLedger(),
      shown('logs_search#1', 'logs_search#1.2'),
    );

    expect(verified.facts).toEqual([
      {
        text: 'timeouts today',
        citations: [],
        evidence: [{ ref: 'logs_search#1.2', tool: 'logs_search', summary: 'row logs_search#1.2' }],
      },
    ]);
    expect(verified.support).toBe(AnswerSupport.SUPPORTED);
  });

  it('demotes a claim whose runtime row was never shown, naming the ref', () => {
    const verified = verifyAnswer(
      draftWith({ text: 'invented', citations: [], evidence: ['logs_search#9.1'] }),
      snapshot,
      new EvidenceLedger(),
      shown('logs_search#1.1'),
    );

    expect(verified.facts).toEqual([]);
    expect(verified.assumptions[0]).toMatchObject({
      origin: AssumptionOrigin.UNVERIFIED_CLAIM,
      problems: [
        {
          citation: null,
          evidenceRef: 'logs_search#9.1',
          failure: CitationFailure.EVIDENCE_NOT_SHOWN,
        },
      ],
    });
    expect(verified.support).toBe(AnswerSupport.UNSUPPORTED);
  });

  it('needs both the code lines and the runtime rows to be real when a claim cites both', () => {
    const claim = {
      text: 'timeout set in code and seen in logs',
      citations: [cite('apps/api/a.ts', 1, 5)],
      evidence: ['logs_search#1.1'],
    };

    const both = verifyAnswer(
      draftWith(claim),
      snapshot,
      ledgerReading(['apps/api/a.ts', 1, 5]),
      shown('logs_search#1.1'),
    );
    const rowOnly = verifyAnswer(
      draftWith(claim),
      snapshot,
      new EvidenceLedger(),
      shown('logs_search#1.1'),
    );

    expect(both.facts).toHaveLength(1);
    expect(rowOnly.facts).toEqual([]);
    expect(rowOnly.assumptions[0]?.problems).toEqual([
      { citation: cite('apps/api/a.ts', 1, 5), failure: CitationFailure.NOT_READ_IN_THIS_RUN },
    ]);
  });

  it('still demotes a claim with neither code citations nor runtime rows', () => {
    const verified = verifyAnswer(
      draftWith({ text: 'bare', citations: [], evidence: [] }),
      snapshot,
      new EvidenceLedger(),
      shown('logs_search#1.1'),
    );

    expect(verified.assumptions[0]?.problems).toEqual([
      { citation: null, failure: CitationFailure.NO_CITATION },
    ]);
  });
});
