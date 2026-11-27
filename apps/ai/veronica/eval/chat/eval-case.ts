import type { ConversationTurn } from '../../src/modules/chat/domain/entities/conversation-turn';

export const EvalKind = {
  KNOWN: 'known',
  UNKNOWN: 'unknown',
} as const;
export type EvalKind = (typeof EvalKind)[keyof typeof EvalKind];

export interface Fixture {
  tool: string;
  match?: Readonly<Record<string, unknown>>;
  response?: unknown;
  error?: string;
}

interface ReferenceCall {
  tool: string;
  input: Readonly<Record<string, unknown>>;
}

interface Expectations {
  conveys: readonly string[];
  mustNotClaim?: readonly string[];
}

export interface EvalCase {
  id: string;
  kind: EvalKind;
  question: string;
  history?: readonly ConversationTurn[];
  fixtures: readonly Fixture[];
  requiredTools: readonly string[];
  forbiddenTools?: readonly string[];
  expectations: Expectations;
  forbiddenText?: readonly string[];
  reference: { calls: readonly ReferenceCall[]; answer: string };
}

export const callKey = (tool: string, input: unknown): string => {
  const template = (input as { template?: unknown } | null)?.template;
  return tool === 'metrics_query' && typeof template === 'string' ? `${tool}:${template}` : tool;
};
