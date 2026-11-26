import * as fc from 'fast-check';
import { z } from 'zod';

import { defineTool } from './define-tool';
import { RowList, fitRowList } from './row-list';

const HINT = 'pass name=<part of the name> to see fewer rows';

const row = fc.record({ name: fc.string({ maxLength: 40 }), count: fc.integer() });

describe('fitRowList', () => {
  it('returns the whole list when it fits', () => {
    const list = RowList.of([{ id: 1 }, { id: 2 }], HINT);

    expect(JSON.parse(fitRowList(list, 1000))).toEqual({ rows: [{ id: 1 }, { id: 2 }] });
  });

  it('drops whole rows from the end and says how many and how to ask for them', () => {
    const list = RowList.of(
      Array.from({ length: 50 }, (_, index) => ({ id: index })),
      HINT,
    );

    const parsed = JSON.parse(fitRowList(list, 200));

    expect(parsed.rows[0]).toEqual({ id: 0 });
    expect(parsed.rows.length + parsed.omitted).toBe(50);
    expect(parsed.hint).toBe(HINT);
  });

  it('keeps every row when they all fit, even when a cut list with its hint would not', () => {
    const list = RowList.of(['a', 'b', 'c', 'd', 'e'], 'x'.repeat(50));
    const whole = JSON.stringify(list.withAllRows());

    expect(JSON.parse(fitRowList(list, whole.length))).toEqual({ rows: ['a', 'b', 'c', 'd', 'e'] });
  });

  it('keeps the frame around the rows', () => {
    const list = RowList.of([{ id: 1 }], HINT, (rows, omission) => ({
      jobs: rows,
      ...omission,
    })).around((inner) => ({ template: 'jobs', data: inner }));

    expect(JSON.parse(fitRowList(list, 1000))).toEqual({
      template: 'jobs',
      data: { jobs: [{ id: 1 }] },
    });
  });

  it('always yields valid JSON within the cap holding a prefix of complete rows', () => {
    fc.assert(
      fc.property(
        fc.array(row, { maxLength: 60 }),
        fc.integer({ min: 120, max: 4000 }),
        (rows, cap) => {
          const text = fitRowList(RowList.of(rows, HINT), cap);
          const parsed = JSON.parse(text);

          expect(text.length).toBeLessThanOrEqual(cap);
          expect(parsed.rows).toEqual(rows.slice(0, parsed.rows.length));
          expect(parsed.rows.length + (parsed.omitted ?? 0)).toBe(rows.length);
          expect(parsed.omitted === undefined).toBe(parsed.hint === undefined);
        },
      ),
    );
  });

  it('keeps as many rows as fit, so one more row would break the cap', () => {
    fc.assert(
      fc.property(
        fc.array(row, { minLength: 1, maxLength: 60 }),
        fc.integer({ min: 120, max: 4000 }),
        (rows, cap) => {
          const list = RowList.of(rows, HINT);
          const kept = JSON.parse(fitRowList(list, cap)).rows.length;
          fc.pre(kept < rows.length);

          expect(JSON.stringify(list.withFirst(kept + 1)).length).toBeGreaterThan(cap);
        },
      ),
    );
  });
});

describe('defineTool with a row list', () => {
  it('fits the rows into the tool output cap instead of cutting the text', async () => {
    const tool = defineTool({
      name: 'jobs',
      description: 'Jobs',
      inputSchema: z.object({}),
      readOnly: true,
      maxOutputChars: 300,
      handler: () =>
        Promise.resolve(
          RowList.of(
            Array.from({ length: 40 }, (_, index) => ({ job: `job-${index}` })),
            HINT,
          ),
        ),
    });

    const output = await tool.run({}, { runId: 'run-1' });

    expect(output.length).toBeLessThanOrEqual(300);
    expect(JSON.parse(output).omitted).toBeGreaterThan(0);
  });
});
