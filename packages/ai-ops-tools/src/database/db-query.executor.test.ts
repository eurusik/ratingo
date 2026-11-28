import { RowList, fitRowList } from '@ratingo/ai-core';

import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';
import { recordingLogger } from '../testing/recording-logger';

import { DB_QUERY_OUTPUT_CAP, QueryRefusal } from './database.constants';
import {
  ExplorerFailureError,
  ExplorerNotConfiguredError,
  ExplorerQueryRefusedError,
  ExplorerUnavailableError,
  type ExplorerPort,
  type QueryRequest,
  type QueryRows,
} from './database.port';
import { DbQueryExecutor } from './db-query.executor';

const rows = (count: number, hasMoreRows = false): QueryRows => ({
  columns: ['n'],
  rows: Array.from({ length: count }, (_unused, index) => ({ n: index })),
  hasMoreRows,
});

const explorerAnswering = (
  answer: QueryRows | Error,
  asked: QueryRequest[] = [],
): ExplorerPort => ({
  schema: async () => ({ tables: [], privateTables: [] }),
  query: async (request) => {
    asked.push(request);
    if (answer instanceof Error) throw answer;
    return answer;
  },
});

const shown = (result: unknown): unknown =>
  result instanceof RowList ? result.withAllRows() : result;

describe('DbQueryExecutor', () => {
  it('passes one validated statement with the row limit and returns the rows', async () => {
    const asked: QueryRequest[] = [];
    const executor = new DbQueryExecutor(explorerAnswering(rows(2), asked), recordingLogger());

    const result = shown(await executor.run({ sql: 'select 1 as n; ' }));

    expect(asked).toEqual([{ sql: 'select 1 as n', explain: false, rowLimit: 100 }]);
    expect(result).toEqual({ columns: ['n'], rowLimit: 100, rows: [{ n: 0 }, { n: 1 }] });
  });

  it('says that more rows exist, as a lower bound, when the row limit was reached', async () => {
    const executor = new DbQueryExecutor(explorerAnswering(rows(3, true)), recordingLogger(), {
      rowLimit: 3,
    });

    const result = shown(await executor.run({ sql: 'select n from t' }));

    expect(result).toEqual({
      columns: ['n'],
      rowLimit: 3,
      rows: [{ n: 0 }, { n: 1 }, { n: 2 }],
      omitted: 1,
      omittedIsLowerBound: true,
      hint: 'add WHERE, GROUP BY or a smaller LIMIT, or select fewer columns',
    });
  });

  it('cuts by whole rows when the text is too long and counts the rows it left out', async () => {
    const wide: QueryRows = {
      columns: ['text'],
      rows: Array.from({ length: 100 }, (_unused, index) => ({
        text: `${index} ${'x'.repeat(200)}`,
      })),
      hasMoreRows: false,
    };
    const executor = new DbQueryExecutor(explorerAnswering(wide), recordingLogger());

    const output = await executor.run({ sql: 'select text from t' });
    const parsed = JSON.parse(fitRowList(output as RowList, DB_QUERY_OUTPUT_CAP)) as {
      rows: unknown[];
      omitted: number;
      omittedIsLowerBound?: boolean;
    };

    expect(parsed.rows.length + parsed.omitted).toBe(100);
    expect(parsed.rows.length).toBeLessThan(100);
    expect(parsed.omittedIsLowerBound).toBeUndefined();
  });

  it('says what an empty answer does and does not cover', async () => {
    const executor = new DbQueryExecutor(explorerAnswering(rows(0)), recordingLogger());

    const result = shown(await executor.run({ sql: 'select n from t where false' })) as {
      note: string;
    };

    expect(result.note).toContain('only the tables and columns the database role may read');
    expect(result.note).toContain('soft-deleted rows included');
  });

  it('returns the plan without claiming any data was read when explain is true', async () => {
    const asked: QueryRequest[] = [];
    const plan: QueryRows = {
      columns: ['QUERY PLAN'],
      rows: [{ 'QUERY PLAN': 'Seq Scan on users' }, { 'QUERY PLAN': '  Filter: true' }],
      hasMoreRows: false,
    };
    const executor = new DbQueryExecutor(explorerAnswering(plan, asked), recordingLogger());

    const result = await executor.run({ sql: 'select * from users', explain: true });

    expect(asked[0]?.explain).toBe(true);
    expect(result).toEqual({
      plan: ['Seq Scan on users', '  Filter: true'],
      note: 'This is only the planner estimate: the query was not run and no data was read.',
    });
  });

  it.each([
    [QueryRefusal.PRIVATE, 'permission denied for table users', 'This data is private'],
    [
      QueryRefusal.NOT_FOUND,
      'relation "x" does not exist',
      'No readable table, column or function matches',
    ],
    [
      QueryRefusal.INVALID_QUERY,
      'syntax error at or near "frm"',
      'The database rejected the query',
    ],
    [
      QueryRefusal.TIMEOUT,
      'canceling statement due to statement timeout',
      'stopped the query at the 5-second time limit',
    ],
    [QueryRefusal.BUSY, 'too many connections for role', 'The database is busy'],
    [
      QueryRefusal.NOT_ALLOWED,
      'permission denied for function pg_terminate_backend',
      'This is not allowed for the read-only database role',
    ],
  ])(
    'answers a %s refusal as a result with its status and logs the reason',
    async (refusal, detail, start) => {
      const logger = recordingLogger();
      const executor = new DbQueryExecutor(
        explorerAnswering(new ExplorerQueryRefusedError(refusal, detail)),
        logger,
      );

      const result = (await executor.run({ sql: 'select 1' })) as {
        status: string;
        message: string;
      };

      expect(result.status).toBe(refusal);
      expect(result.message).toContain(start);
      const expected = [`db_query failed: ${refusal}`];
      const quiet = (
        [
          QueryRefusal.PRIVATE,
          QueryRefusal.NOT_FOUND,
          QueryRefusal.INVALID_QUERY,
          QueryRefusal.NOT_ALLOWED,
        ] as string[]
      ).includes(refusal);
      expect(quiet ? logger.debugs : logger.warnings).toEqual(expected);
      expect(quiet ? logger.warnings : logger.debugs).toEqual([]);
    },
  );

  it('never calls a private refusal a missing table', async () => {
    const executor = new DbQueryExecutor(
      explorerAnswering(
        new ExplorerQueryRefusedError(QueryRefusal.PRIVATE, 'permission denied for table users'),
      ),
      recordingLogger(),
    );

    const result = (await executor.run({ sql: 'select email from users' })) as { message: string };

    expect(result.message).toContain('Tell the owner it is private, not that it does not exist');
    expect(result.message).not.toContain('No readable table');
  });

  it('tells a timeout answer to give no numbers', async () => {
    const executor = new DbQueryExecutor(
      explorerAnswering(new ExplorerQueryRefusedError(QueryRefusal.TIMEOUT, 'timeout')),
      recordingLogger(),
    );

    const result = (await executor.run({ sql: 'select 1' })) as { message: string };

    expect(result.message).toContain('returned no rows, not even partial ones');
    expect(result.message).toContain('Do not state any number from it');
    expect(result.message).toContain('stopped the query at the 5-second time limit');
    expect(result.message).toContain('One narrower query');
    expect(result.message).toContain('repeating heavy variants of the same query will not help');
  });

  it('reports itself unavailable with the reason when the connection fails, and logs it', async () => {
    const logger = recordingLogger();
    const executor = new DbQueryExecutor(
      explorerAnswering(new ExplorerFailureError('network')),
      logger,
    );

    await expect(executor.run({ sql: 'select 1' })).rejects.toThrow(
      new ExplorerUnavailableError('db_query', 'network'),
    );
    expect(logger.warnings).toEqual(['db_query failed: network']);
  });

  it('reports a missing configuration without logging it on every call', async () => {
    const logger = recordingLogger();
    const executor = new DbQueryExecutor(
      explorerAnswering(new ExplorerNotConfiguredError()),
      logger,
    );

    await expect(executor.run({ sql: 'select 1' })).rejects.toThrow(
      'db_query is unavailable: AI_EXPLORER_DATABASE_URL is not set',
    );
    expect(logger.warnings).toEqual([]);
  });

  it('refuses a write before it reaches the database', async () => {
    const asked: QueryRequest[] = [];
    const executor = new DbQueryExecutor(explorerAnswering(rows(1), asked), recordingLogger());

    await expect(executor.run({ sql: 'delete from users' })).rejects.toThrow(InvalidOpsInputError);
    expect(asked).toEqual([]);
  });
});
