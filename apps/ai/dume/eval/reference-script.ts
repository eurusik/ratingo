import { ContentPartType, StopReason, formatModelRef, type StubScript } from '@ratingo/ai-core';

import type { EvalCase } from './eval-case';
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

export const buildReferenceScript = async (
  testCase: EvalCase,
  snapshot: CodeSnapshot,
): Promise<StubScript> => {
  const located = await locate(testCase, snapshot);
  const answer = {
    answer: testCase.reference.answer,
    claims: testCase.reference.claims.map((claim) => ({
      text: claim.text,
      citations: claim.evidence.map((index) => (located[index] as LocatedEvidence).citation),
    })),
    assumptions: [],
    unknowns: testCase.reference.unknowns,
  };
  return {
    respond: (request, callIndex) => {
      const model = formatModelRef({ provider: 'stub', model: request.model });
      if (callIndex === 0 && located.length > 0) {
        return {
          model,
          stopReason: StopReason.TOOL_USE,
          usage: STUB_USAGE,
          content: located.map((entry, index) => ({
            type: ContentPartType.TOOL_CALL,
            call: { id: `reference-read-${index}`, name: CODE_READ_TOOL, input: entry.read },
          })),
        };
      }
      return {
        model,
        stopReason: StopReason.END,
        usage: STUB_USAGE,
        content: [{ type: ContentPartType.TEXT, text: JSON.stringify(answer) }],
      };
    },
  };
};
