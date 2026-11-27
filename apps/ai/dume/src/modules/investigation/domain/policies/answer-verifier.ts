import { CitationLimits } from '../constants/investigation.constants';
import type { CodeSnapshot } from '../entities/code-snapshot';
import {
  AnswerSupport,
  AssumptionOrigin,
  CitationFailure,
  type Assumption,
  type Citation,
  type CitationProblem,
  type DraftClaim,
  type InvestigationDraft,
  type VerifiedAnswer,
  type VerifiedClaim,
} from '../entities/investigation-answer';
import type { EvidenceLedger } from './evidence-ledger';
import { normalizeFilePath } from './repo-path';

type SnapshotView = Pick<CodeSnapshot, 'fileAt'>;

interface CheckedCitation {
  citation: Citation | null;
  failure: CitationFailure | null;
}

const isWholeLineNumber = (value: number): boolean => Number.isInteger(value) && value >= 1;

const checkCitation = (
  citation: Citation,
  snapshot: SnapshotView,
  ledger: EvidenceLedger,
): CheckedCitation => {
  const normalized = normalizeFilePath(citation.path);
  if (!normalized.ok) return { citation, failure: CitationFailure.INVALID_PATH };
  const file = snapshot.fileAt(normalized.path);
  if (file === undefined) return { citation, failure: CitationFailure.FILE_NOT_IN_SNAPSHOT };
  const { startLine, endLine } = citation;
  if (!isWholeLineNumber(startLine) || !isWholeLineNumber(endLine) || endLine < startLine || endLine > file.lineCount) {
    return { citation, failure: CitationFailure.LINES_OUT_OF_RANGE };
  }
  if (endLine - startLine + 1 > CitationLimits.MAX_LINES_PER_CITATION) {
    return { citation, failure: CitationFailure.RANGE_TOO_LARGE };
  }
  if (!ledger.covers(normalized.path, startLine, endLine)) {
    return { citation, failure: CitationFailure.NOT_READ_IN_THIS_RUN };
  }
  return { citation: { path: normalized.path, startLine, endLine }, failure: null };
};

const problemsOf = (checked: readonly CheckedCitation[]): CitationProblem[] =>
  checked.flatMap((entry) =>
    entry.failure === null ? [] : [{ citation: entry.citation, failure: entry.failure }],
  );

const verifyClaim = (
  claim: DraftClaim,
  snapshot: SnapshotView,
  ledger: EvidenceLedger,
): { claim: VerifiedClaim } | { demoted: Assumption } => {
  if (claim.citations.length === 0) {
    return {
      demoted: {
        text: claim.text,
        origin: AssumptionOrigin.UNVERIFIED_CLAIM,
        problems: [{ citation: null, failure: CitationFailure.NO_CITATION }],
      },
    };
  }
  const checked = claim.citations.map((citation) => checkCitation(citation, snapshot, ledger));
  const problems = problemsOf(checked);
  if (problems.length > 0) {
    return { demoted: { text: claim.text, origin: AssumptionOrigin.UNVERIFIED_CLAIM, problems } };
  }
  return {
    claim: {
      text: claim.text,
      citations: checked.flatMap((entry) => (entry.citation === null ? [] : [entry.citation])),
    },
  };
};

const supportOf = (facts: number, demoted: number): AnswerSupport => {
  if (facts === 0 && demoted === 0) return AnswerSupport.NO_CLAIMS;
  if (facts === 0) return AnswerSupport.UNSUPPORTED;
  return demoted === 0 ? AnswerSupport.SUPPORTED : AnswerSupport.PARTLY_SUPPORTED;
};

export const verifyAnswer = (
  draft: InvestigationDraft,
  snapshot: SnapshotView,
  ledger: EvidenceLedger,
): VerifiedAnswer => {
  const facts: VerifiedClaim[] = [];
  const demoted: Assumption[] = [];
  for (const claim of draft.claims) {
    const verified = verifyClaim(claim, snapshot, ledger);
    if ('claim' in verified) facts.push(verified.claim);
    else demoted.push(verified.demoted);
  }
  const stated: Assumption[] = draft.assumptions.map((text) => ({
    text,
    origin: AssumptionOrigin.STATED_BY_MODEL,
    problems: [],
  }));
  return {
    answer: draft.answer,
    facts,
    assumptions: [...demoted, ...stated],
    unknowns: [...draft.unknowns],
    support: supportOf(facts.length, demoted.length),
  };
};
