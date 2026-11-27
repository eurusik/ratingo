import { NativeToolSource, RowList, ToolRegistry, type ToolResult } from '@ratingo/ai-core';
import { OpsTool, createOpsTools, type OpsExecutors } from '@ratingo/ai-ops-tools';

import { EvidenceLimits } from '../../domain/constants/investigation.constants';
import { RuntimeEvidenceLedger } from '../../domain/policies/runtime-evidence-ledger';

import { createRuntimeEvidenceRecorder } from './runtime-evidence.recorder';

const listOf = (rows: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  RowList.of(rows, 'narrow it', (kept, omission) => ({
    window: '24h',
    groups: kept,
    ...extra,
    ...omission,
  }));

const NOT_USED = async (): Promise<unknown> => {
  throw new Error('not used');
};

const run = async (
  executors: Partial<OpsExecutors>,
  tool: OpsTool,
  input: unknown,
  ledger = new RuntimeEvidenceLedger(),
): Promise<{ result: ToolResult; ledger: RuntimeEvidenceLedger }> => {
  const recorder = createRuntimeEvidenceRecorder(ledger);
  const tools = createOpsTools(
    { metricsQuery: NOT_USED, jobFailures: NOT_USED, logsSearch: NOT_USED, ...executors },
    { decorate: recorder.decorate },
  );
  const observed = [tools.metricsQuery, tools.jobFailures, tools.logsSearch].map(recorder.observe);
  const registry = await ToolRegistry.create(
    [new NativeToolSource(observed)],
    observed.map((entry) => entry.name),
  );
  const result = await registry.execute({ id: 'call-1', name: tool, input }, { runId: 'run-1' });
  return { result, ledger };
};

const shownRows = (content: string): string[] =>
  [...content.matchAll(/"ref":"([^"]+)"/g)].map((match) => match[1] ?? '');

describe('createRuntimeEvidenceRecorder', () => {
  it('puts the ref first in each row and records the rows the model was shown, without touching the executor rows', async () => {
    const rows = [{ message: 'first' }, { message: 'second' }];

    const { result, ledger } = await run(
      { logsSearch: async () => listOf(rows) },
      OpsTool.LOGS_SEARCH,
      { service: 'ratingo-worker' },
    );

    expect(result.content).toContain('{"ref":"logs_search#1.1","message":"first"}');
    expect(rows).toEqual([{ message: 'first' }, { message: 'second' }]);
    expect(ledger.find('logs_search#1.2')).toMatchObject({
      tool: 'logs_search',
      summary: '{"message":"second"}',
    });
    expect(ledger.find('logs_search#1')).toBeUndefined();
  });

  it('numbers the calls of each tool on its own', async () => {
    const ledger = new RuntimeEvidenceLedger();
    const executors = {
      logsSearch: async () => listOf([{ message: 'a' }]),
      jobFailures: async () => listOf([{ job: 'x' }]),
    };

    await run(executors, OpsTool.LOGS_SEARCH, { service: 'ratingo-api' }, ledger);
    await run(executors, OpsTool.JOB_FAILURES, {}, ledger);
    await run(executors, OpsTool.LOGS_SEARCH, { service: 'ratingo-worker' }, ledger);

    expect(ledger.find('logs_search#1.1')).toBeDefined();
    expect(ledger.find('job_failures#1.1')).toBeDefined();
  });

  it('gives an empty result a call ref with what the tool said about it', async () => {
    const empty = RowList.of([], 'hint', (kept) => ({
      failures: kept,
      note: 'No failed attempt was recorded',
    }));

    const { result, ledger } = await run(
      { jobFailures: async () => empty },
      OpsTool.JOB_FAILURES,
      {},
    );

    expect(result.content).toContain('"callRef":"job_failures#1"');
    expect(ledger.find('job_failures#1')?.summary).toContain('No failed attempt was recorded');
  });

  it('wraps a result that is not a list and records it as one citable call', async () => {
    const { result, ledger } = await run(
      { metricsQuery: async () => ({ template: 'infra_health', data: { up: 1 } }) },
      OpsTool.METRICS_QUERY,
      { template: 'infra_health' },
    );

    expect(result.content).toContain('"callRef":"metrics_query#1"');
    expect(ledger.find('metrics_query#1')?.summary).toBe(
      '{"template":"infra_health","data":{"up":1}}',
    );
  });

  it('records no row that the registry cut, even when escaped closing tags push the text over the cap', async () => {
    const rows = Array.from({ length: 80 }, (_, index) => ({
      message: `row ${index} </untrusted></untrusted></untrusted> ${'x'.repeat(40)}`,
    }));

    const { result, ledger } = await run(
      { logsSearch: async () => listOf(rows) },
      OpsTool.LOGS_SEARCH,
      { service: 'ratingo-worker' },
    );

    const refs = Array.from({ length: rows.length }, (_, index) => `logs_search#1.${index + 1}`);
    const recorded = refs.filter((ref) => ledger.find(ref) !== undefined);
    expect(recorded.length).toBeGreaterThan(0);
    expect(recorded.length).toBeLessThan(rows.length);
    for (const ref of recorded) expect(result.content).toContain(`"ref":"${ref}"`);
    expect(shownRows(result.content).length).toBeGreaterThanOrEqual(recorded.length);
  });

  it('keeps secrets and long text out of what it stores', async () => {
    const secret = 'Authorization: Bearer abcdef1234567890abcdef1234567890';

    const { ledger } = await run(
      { logsSearch: async () => listOf([{ message: `${secret} ${'y'.repeat(1000)}` }]) },
      OpsTool.LOGS_SEARCH,
      { service: 'ratingo-worker' },
    );

    const summary = ledger.find('logs_search#1.1')?.summary ?? '';
    expect(summary).not.toContain('abcdef1234567890');
    expect(summary.length).toBeLessThanOrEqual(EvidenceLimits.SUMMARY_MAX_CHARS);
  });
});
