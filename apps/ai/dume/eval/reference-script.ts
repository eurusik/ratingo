import {
  ContentPartType,
  StopReason,
  formatModelRef,
  type ChatMessage,
  type ModelRequest,
  type StubScript,
} from '@ratingo/ai-core';

import type { EvalCase, RuntimeSource } from './eval-case';
import { CODE_READ_TOOL, Citation, CodeSnapshot } from '../src/modules/investigation/public';

const READ_LINES_BEFORE = 8;
const READ_LINES_AFTER = 12;
const CITE_LINES_AROUND = 4;
const STUB_USAGE = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
  reasoningTokens: 0,
};

export class StaleCaseError extends Error {
  constructor(caseId: string, path: string, anchor: string) {
    super(
      `Case "${caseId}" is stale: "${anchor}" is no longer in ${path}. Update its evidence from the current code.`,
    );
    this.name = 'StaleCaseError';
  }
}

interface LocatedEvidence {
  read: { path: string; startLine: number; endLine: number };
  citation: Citation;
}

const locate = async (testCase: EvalCase, snapshot: CodeSnapshot): Promise<LocatedEvidence[]> =>
  Promise.all(
    testCase.evidence.map(async (evidence) => {
      const lines = await snapshot.readLines(evidence.path);
      const index = lines?.findIndex((line) => line.includes(evidence.anchor)) ?? -1;
      if (lines === undefined || index === -1)
        throw new StaleCaseError(testCase.id, evidence.path, evidence.anchor);
      const line = index + 1;
      return {
        read: {
          path: evidence.path,
          startLine: Math.max(1, line - READ_LINES_BEFORE),
          endLine: Math.min(lines.length, line + READ_LINES_AFTER),
        },
        citation: {
          path: evidence.path,
          startLine: Math.max(1, line - CITE_LINES_AROUND),
          endLine: Math.min(lines.length, line + CITE_LINES_AROUND),
        },
      };
    }),
  );

const UNRESOLVED_REF = 'unresolved-runtime-evidence';
const UNTRUSTED_WRAPPER = /^<untrusted[^>]*>\n([\s\S]*)\n<\/untrusted>$/;

const callIdOf = (index: number): string => `reference-runtime-${index}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const toolResultOf = (messages: readonly ChatMessage[], callId: string): unknown => {
  const content = messages
    .flatMap((message) => message.content)
    .flatMap((part) =>
      part.type === ContentPartType.TOOL_RESULT && part.result.callId === callId
        ? [part.result.content]
        : [],
    )[0];
  if (content === undefined) return undefined;
  try {
    return JSON.parse(UNTRUSTED_WRAPPER.exec(content)?.[1] ?? content);
  } catch {
    return undefined;
  }
};

const rowRefContaining = (value: unknown, anchor: string): string | undefined => {
  if (Array.isArray(value)) {
    return value.map((item) => rowRefContaining(item, anchor)).find((ref) => ref !== undefined);
  }
  if (!isRecord(value)) return undefined;
  const nested = Object.values(value)
    .map((item) => rowRefContaining(item, anchor))
    .find((ref) => ref !== undefined);
  if (nested !== undefined) return nested;
  return typeof value.ref === 'string' && JSON.stringify(value).includes(anchor)
    ? value.ref
    : undefined;
};

const refOf = (source: RuntimeSource, index: number, request: ModelRequest): string => {
  const result = toolResultOf(request.messages, callIdOf(index));
  if (source.anchor === undefined) {
    return isRecord(result) && typeof result.callRef === 'string' ? result.callRef : UNRESOLVED_REF;
  }
  return rowRefContaining(result, source.anchor) ?? UNRESOLVED_REF;
};

export const buildReferenceScript = async (
  testCase: EvalCase,
  snapshot: CodeSnapshot,
): Promise<StubScript> => {
  const located = await locate(testCase, snapshot);
  const sources = testCase.runtimeSources ?? [];
  const answerFor = (request: ModelRequest) => ({
    answer: testCase.reference.answer,
    claims: testCase.reference.claims.map((claim) => ({
      text: claim.text,
      citations: claim.evidence.map((index) => (located[index] as LocatedEvidence).citation),
      evidence: (claim.runtime ?? []).map((index) =>
        refOf(sources[index] as RuntimeSource, index, request),
      ),
    })),
    assumptions: [],
    unknowns: testCase.reference.unknowns,
  });
  return {
    respond: (request, callIndex) => {
      const model = formatModelRef({ provider: 'stub', model: request.model });
      if (callIndex === 0 && (located.length > 0 || sources.length > 0)) {
        return {
          model,
          stopReason: StopReason.TOOL_USE,
          usage: STUB_USAGE,
          content: [
            ...located.map((entry, index) => ({
              type: ContentPartType.TOOL_CALL,
              call: { id: `reference-read-${index}`, name: CODE_READ_TOOL, input: entry.read },
            })),
            ...sources.map((source, index) => ({
              type: ContentPartType.TOOL_CALL,
              call: { id: callIdOf(index), name: source.tool, input: source.input },
            })),
          ],
        };
      }
      return {
        model,
        stopReason: StopReason.END,
        usage: STUB_USAGE,
        content: [{ type: ContentPartType.TEXT, text: JSON.stringify(answerFor(request)) }],
      };
    },
  };
};
