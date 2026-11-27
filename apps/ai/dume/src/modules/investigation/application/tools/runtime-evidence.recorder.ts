import {
  RowList,
  TRUNCATION_MARKER,
  redactSecrets,
  sanitizeToolOutput,
  type Tool,
} from '@ratingo/ai-core';
import type { OpsOutputDecorator, OpsTool } from '@ratingo/ai-ops-tools';

import { EvidenceLimits } from '../../domain/constants/investigation.constants';
import type { ShownEvidence } from '../../domain/entities/investigation-answer';
import type { RuntimeEvidenceLedger } from '../../domain/policies/runtime-evidence-ledger';

const REF_FIELD = /"(?:ref|callRef)":"([^"]+)"/g;

const summaryOf = (value: unknown): string =>
  redactSecrets(JSON.stringify(value) ?? '').slice(0, EvidenceLimits.SUMMARY_MAX_CHARS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const refsIn = (text: string): string[] =>
  [...text.matchAll(REF_FIELD)].map((match) => match[1] ?? '');

export interface RuntimeEvidenceRecorder {
  decorate: OpsOutputDecorator;
  observe(tool: Tool): Tool;
}

export const createRuntimeEvidenceRecorder = (
  ledger: RuntimeEvidenceLedger,
): RuntimeEvidenceRecorder => {
  const callsByTool = new Map<OpsTool, number>();
  const offered = new Map<string, ShownEvidence>();

  const nextCallRef = (tool: OpsTool): string => {
    const callNumber = (callsByTool.get(tool) ?? 0) + 1;
    callsByTool.set(tool, callNumber);
    return `${tool}#${callNumber}`;
  };

  const offer = (ref: string, tool: OpsTool, summary: string): void => {
    offered.set(ref, { ref, tool, summary });
  };

  const tagRows = (tool: OpsTool, callRef: string, list: RowList): RowList =>
    list.mapRows((row, index) => {
      const ref = `${callRef}.${index + 1}`;
      offer(ref, tool, summaryOf(row));
      return isRecord(row) ? { ref, ...row } : row;
    });

  const tagCall = (tool: OpsTool, callRef: string, output: unknown): unknown => {
    if (output instanceof RowList) {
      offer(callRef, tool, summaryOf(output.withFirst(0)));
      return output.around((inner) => ({ callRef, ...(isRecord(inner) ? inner : {}) }));
    }
    offer(callRef, tool, summaryOf(output));
    return isRecord(output) ? { callRef, ...output } : { callRef, value: output };
  };

  const decorate: OpsOutputDecorator = (tool, output) => {
    const callRef = nextCallRef(tool);
    return output instanceof RowList && output.rows.length > 0
      ? tagRows(tool, callRef, output)
      : tagCall(tool, callRef, output);
  };

  const confirmShown = (tool: Tool, content: string): void => {
    const visible = sanitizeToolOutput(tool, content);
    const refs = refsIn(visible);
    const mayBeCut = visible.endsWith(TRUNCATION_MARKER);
    const complete = mayBeCut ? refs.slice(0, -1) : refs;
    for (const ref of complete) {
      const evidence = offered.get(ref);
      if (evidence !== undefined) ledger.record(evidence);
    }
  };

  const observe = (tool: Tool): Tool => ({
    ...tool,
    run: async (rawInput, context) => {
      const content = await tool.run(rawInput, context);
      confirmShown(tool, content);
      return content;
    },
  });

  return { decorate, observe };
};
