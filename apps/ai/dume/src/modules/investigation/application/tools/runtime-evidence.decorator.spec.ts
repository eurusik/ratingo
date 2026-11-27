import { RowList, fitRowList } from '@ratingo/ai-core';
import { OpsTool, opsContentBudget } from '@ratingo/ai-ops-tools';

import { EvidenceLimits } from '../../domain/constants/investigation.constants';
import { RuntimeEvidenceLedger } from '../../domain/policies/runtime-evidence-ledger';

import { createRuntimeEvidenceDecorator } from './runtime-evidence.decorator';

const listOf = (rows: Record<string, unknown>[]) =>
  RowList.of(rows, 'narrow it', (kept, omission) => ({ window: '24h', groups: kept, ...omission }));

const setup = () => {
  const ledger = new RuntimeEvidenceLedger();
  return { ledger, decorate: createRuntimeEvidenceDecorator(ledger) };
};

describe('createRuntimeEvidenceDecorator', () => {
  it('gives the call and every row a ref and records the rows the model will see', () => {
    const { ledger, decorate } = setup();

    const output = decorate(
      OpsTool.LOGS_SEARCH,
      listOf([{ message: 'first' }, { message: 'second' }]),
    );

    expect(JSON.parse(fitRowList(output as RowList, 10_000))).toEqual({
      callRef: 'logs_search#1',
      window: '24h',
      groups: [
        { message: 'first', ref: 'logs_search#1.1' },
        { message: 'second', ref: 'logs_search#1.2' },
      ],
    });
    expect(ledger.find('logs_search#1.2')).toMatchObject({
      tool: 'logs_search',
      summary: '{"message":"second"}',
    });
    expect(ledger.find('logs_search#1')?.summary).toContain('"callRef":"logs_search#1"');
  });

  it('numbers the calls of each tool on its own', () => {
    const { ledger, decorate } = setup();

    decorate(OpsTool.LOGS_SEARCH, listOf([{ message: 'a' }]));
    decorate(OpsTool.JOB_FAILURES, listOf([{ job: 'x' }]));
    decorate(OpsTool.LOGS_SEARCH, listOf([{ message: 'b' }]));

    expect(['logs_search#2.1', 'job_failures#1.1'].map((ref) => ledger.find(ref)?.tool)).toEqual([
      'logs_search',
      'job_failures',
    ]);
  });

  it('records an empty result as a call that can be cited, with what the tool said about it', () => {
    const { ledger, decorate } = setup();

    const empty = RowList.of([], 'hint', (kept) => ({
      failures: kept,
      note: 'No failed attempt was recorded',
    }));
    decorate(OpsTool.JOB_FAILURES, empty);

    expect(ledger.find('job_failures#1')?.summary).toContain('No failed attempt was recorded');
    expect(ledger.find('job_failures#1.1')).toBeUndefined();
  });

  it('records only the rows that fit in what the model is shown', () => {
    const { ledger, decorate } = setup();
    const rows = Array.from({ length: 200 }, (_, index) => ({
      message: `row ${index} ${'x'.repeat(60)}`,
    }));

    const output = decorate(OpsTool.LOGS_SEARCH, listOf(rows)) as RowList;
    const shown = (
      JSON.parse(fitRowList(output, opsContentBudget(OpsTool.LOGS_SEARCH))) as {
        groups: { ref: string }[];
      }
    ).groups;

    expect(shown.length).toBeLessThan(rows.length);
    expect(ledger.find(`logs_search#1.${shown.length}`)).toBeDefined();
    expect(ledger.find(`logs_search#1.${shown.length + 1}`)).toBeUndefined();
  });

  it('wraps a result that is not a list and records it as one citable call', () => {
    const { ledger, decorate } = setup();

    const output = decorate(OpsTool.METRICS_QUERY, { template: 'infra_health', data: { up: 1 } });

    expect(output).toEqual({
      callRef: 'metrics_query#1',
      template: 'infra_health',
      data: { up: 1 },
    });
    expect(ledger.find('metrics_query#1')?.summary).toBe(
      '{"template":"infra_health","data":{"up":1}}',
    );
  });

  it('keeps secrets and long text out of what it stores', () => {
    const { ledger, decorate } = setup();
    const secret = 'Authorization: Bearer abcdef1234567890abcdef1234567890';

    decorate(OpsTool.LOGS_SEARCH, listOf([{ message: `${secret} ${'y'.repeat(1000)}` }]));

    const summary = ledger.find('logs_search#1.1')?.summary ?? '';
    expect(summary).not.toContain('abcdef1234567890');
    expect(summary.length).toBeLessThanOrEqual(EvidenceLimits.SUMMARY_MAX_CHARS);
  });
});
