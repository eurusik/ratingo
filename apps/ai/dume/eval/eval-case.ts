export const CaseKind = {
  ANSWERABLE: 'answerable',
  UNKNOWN: 'unknown',
  INJECTION: 'injection',
} as const;
export type CaseKind = (typeof CaseKind)[keyof typeof CaseKind];

import type {
  LokiScenario,
  OpsTool,
  PrometheusSeries,
  SimulatedJobFailureDay,
} from '@ratingo/ai-ops-tools';

interface Evidence {
  path: string;
  anchor: string;
  verifiedAt: string;
}

interface ReferenceClaim {
  text: string;
  codeEvidence: readonly number[];
  runtime?: readonly number[];
}

export interface RuntimeSource {
  tool: OpsTool;
  input: Readonly<Record<string, unknown>>;
  anchor?: string;
}

export interface RuntimeFixture {
  logs?: LokiScenario;
  failures?: readonly SimulatedJobFailureDay[];
  metrics?: readonly PrometheusSeries[];
  unavailable?: readonly OpsTool[];
  database?: { statementTimeoutMs?: number };
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
  runtime?: RuntimeFixture;
  runtimeSources?: readonly RuntimeSource[];
  requiredEvidence?: readonly OpsTool[];
  reference: Reference;
}
