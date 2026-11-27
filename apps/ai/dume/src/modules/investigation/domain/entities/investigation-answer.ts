export interface Citation {
  path: string;
  startLine: number;
  endLine: number;
}

export interface ShownEvidence {
  ref: string;
  tool: string;
  summary: string;
}

export interface DraftClaim {
  text: string;
  citations: readonly Citation[];
  evidence: readonly string[];
}

export interface InvestigationDraft {
  answer: string;
  claims: readonly DraftClaim[];
  assumptions: readonly string[];
  unknowns: readonly string[];
}

export const CitationFailure = {
  NO_CITATION: 'no_citation',
  INVALID_PATH: 'invalid_path',
  FILE_NOT_IN_SNAPSHOT: 'file_not_in_snapshot',
  LINES_OUT_OF_RANGE: 'lines_out_of_range',
  RANGE_TOO_LARGE: 'range_too_large',
  NOT_READ_IN_THIS_RUN: 'not_read_in_this_run',
  EVIDENCE_NOT_SHOWN: 'evidence_not_shown',
} as const;
export type CitationFailure = (typeof CitationFailure)[keyof typeof CitationFailure];

export interface CitationProblem {
  citation: Citation | null;
  evidenceRef?: string;
  failure: CitationFailure;
}

export interface VerifiedClaim {
  text: string;
  citations: readonly Citation[];
  evidence: readonly ShownEvidence[];
}

export const AssumptionOrigin = {
  STATED_BY_MODEL: 'stated_by_model',
  UNVERIFIED_CLAIM: 'unverified_claim',
} as const;
export type AssumptionOrigin = (typeof AssumptionOrigin)[keyof typeof AssumptionOrigin];

export interface Assumption {
  text: string;
  origin: AssumptionOrigin;
  problems: readonly CitationProblem[];
}

export const AnswerSupport = {
  SUPPORTED: 'supported',
  PARTLY_SUPPORTED: 'partly_supported',
  UNSUPPORTED: 'unsupported',
  NO_CLAIMS: 'no_claims',
} as const;
export type AnswerSupport = (typeof AnswerSupport)[keyof typeof AnswerSupport];

export interface VerifiedAnswer {
  answer: string;
  facts: readonly VerifiedClaim[];
  assumptions: readonly Assumption[];
  unknowns: readonly string[];
  support: AnswerSupport;
}
