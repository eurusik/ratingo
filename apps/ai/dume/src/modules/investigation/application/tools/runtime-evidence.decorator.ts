import { RowList, countRowsThatFit, redactSecrets } from '@ratingo/ai-core';
import { opsContentBudget, type OpsOutputDecorator, type OpsTool } from '@ratingo/ai-ops-tools';

import { EvidenceLimits } from '../../domain/constants/investigation.constants';
import type { RuntimeEvidenceLedger } from '../../domain/policies/runtime-evidence-ledger';

const summaryOf = (value: unknown): string =>
  redactSecrets(JSON.stringify(value) ?? '').slice(0, EvidenceLimits.SUMMARY_MAX_CHARS);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const tagRows = (rows: readonly unknown[], callRef: string): string[] =>
  rows.map((row, index) => {
    const ref = `${callRef}.${index + 1}`;
    if (isRecord(row)) Object.assign(row, { ref });
    return ref;
  });

export const createRuntimeEvidenceDecorator = (
  ledger: RuntimeEvidenceLedger,
): OpsOutputDecorator => {
  const callsByTool = new Map<OpsTool, number>();
  const nextCallRef = (tool: OpsTool): string => {
    const callNumber = (callsByTool.get(tool) ?? 0) + 1;
    callsByTool.set(tool, callNumber);
    return `${tool}#${callNumber}`;
  };

  const tagList = (tool: OpsTool, callRef: string, list: RowList): RowList => {
    const summaries = list.rows.map(summaryOf);
    const refs = tagRows(list.rows, callRef);
    const tagged = list.around((inner) => ({ callRef, ...(isRecord(inner) ? inner : {}) }));
    const shown = countRowsThatFit(tagged, opsContentBudget(tool));
    ledger.record({ ref: callRef, tool, summary: summaryOf(tagged.withFirst(0)) });
    refs.slice(0, shown).forEach((ref, index) => {
      ledger.record({ ref, tool, summary: summaries[index] ?? '' });
    });
    return tagged;
  };

  return (tool, output) => {
    const callRef = nextCallRef(tool);
    if (output instanceof RowList) return tagList(tool, callRef, output);
    ledger.record({ ref: callRef, tool, summary: summaryOf(output) });
    return isRecord(output) ? { callRef, ...output } : { callRef, value: output };
  };
};
