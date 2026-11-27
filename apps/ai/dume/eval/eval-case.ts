export const CaseKind = {
  ANSWERABLE: 'answerable',
  UNKNOWN: 'unknown',
  INJECTION: 'injection',
} as const;
export type CaseKind = (typeof CaseKind)[keyof typeof CaseKind];

interface Evidence {
  path: string;
  anchor: string;
  verifiedAt: string;
}

interface ReferenceClaim {
  text: string;
  evidence: readonly number[];
}

interface Reference {
  answer: string;
  claims: readonly ReferenceClaim[];
  unknowns: readonly string[];
}

export interface EvalCase {
  id: string;
  kind: CaseKind;
  question: string;
  evidence: readonly Evidence[];
  requiredFiles: readonly string[];
  conveys: readonly string[];
  mustNotClaim: readonly string[];
  forbiddenText: readonly string[];
  reference: Reference;
}
