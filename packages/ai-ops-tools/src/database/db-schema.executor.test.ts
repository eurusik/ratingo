import { RowList } from '@ratingo/ai-core';

import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';
import { recordingLogger } from '../testing/recording-logger';

import {
  ExplorerFailureError,
  ExplorerNotConfiguredError,
  type ExplorerPort,
  type SchemaListing,
} from './database.port';
import { DbSchemaExecutor } from './db-schema.executor';

const LISTING: SchemaListing = {
  tables: [
    {
      name: 'users',
      kind: 'table',
      rowEstimate: 120,
      columns: [
        { name: 'id', type: 'uuid' },
        { name: 'role', type: 'user_role', enumValues: ['user', 'admin'] },
      ],
      privateColumnCount: 7,
    },
    {
      name: 'user_saved_items',
      kind: 'table',
      rowEstimate: null,
      columns: [{ name: 'list', type: 'saved_item_list' }],
      privateColumnCount: 0,
    },
    {
      name: 'public_media_items',
      kind: 'view',
      rowEstimate: null,
      columns: [{ name: 'id', type: 'uuid' }],
      privateColumnCount: 0,
    },
  ],
  privateTables: ['oauth_accounts', 'refresh_tokens'],
};

const executorWith = (listing: SchemaListing | Error, logger = recordingLogger()) =>
  new DbSchemaExecutor(
    {
      schema: async () => {
        if (listing instanceof Error) throw listing;
        return listing;
      },
      query: async () => {
        throw new Error('not used');
      },
    } satisfies ExplorerPort,
    logger,
  );

const shown = (result: unknown): Record<string, unknown> =>
  (result instanceof RowList ? result.withAllRows() : result) as Record<string, unknown>;

describe('DbSchemaExecutor', () => {
  it('lists every readable table compactly, with enum values, estimates and the private tables', async () => {
    const result = shown(await executorWith(LISTING).run({}));

    expect(result.tables).toEqual([
      { table: 'users', rowsEstimate: 120, columns: 'id, role{user|admin}', privateColumns: 7 },
      { table: 'user_saved_items', rowsEstimate: null, columns: 'list' },
      { table: 'public_media_items', kind: 'view', rowsEstimate: null, columns: 'id' },
    ]);
    expect(result.privateTables).toEqual(['oauth_accounts', 'refresh_tokens']);
    expect(String(result.howToRead)).toContain('private');
  });

  it('lists the tables that match a filter with column types', async () => {
    const result = shown(await executorWith(LISTING).run({ table: 'SAVED' }));

    expect(result.tables).toEqual([
      {
        table: 'user_saved_items',
        rowsEstimate: null,
        columns: [{ name: 'list', type: 'saved_item_list' }],
      },
    ]);
    expect(result.tableFilter).toBe('saved');
    expect(result.privateTables).toBeUndefined();
  });

  it('says that a filter matched nothing and that private tables are not listed either', async () => {
    const result = shown(await executorWith(LISTING).run({ table: 'emails' }));

    expect(result.tables).toEqual([]);
    expect(String(result.note)).toContain('A private table is not listed either');
  });

  it.each(['users; drop', 'a b', '"users"', 'x'.repeat(64)])(
    'refuses the filter %s',
    async (table) => {
      await expect(executorWith(LISTING).run({ table })).rejects.toThrow(InvalidOpsInputError);
    },
  );

  it('reports itself unavailable with the reason and logs a failure', async () => {
    const logger = recordingLogger();

    await expect(executorWith(new ExplorerFailureError('network'), logger).run({})).rejects.toThrow(
      'db_schema is unavailable: network',
    );
    expect(logger.warnings).toEqual(['db_schema failed: network']);
  });

  it('does not log a missing configuration', async () => {
    const logger = recordingLogger();

    await expect(executorWith(new ExplorerNotConfiguredError(), logger).run({})).rejects.toThrow(
      'db_schema is unavailable: AI_EXPLORER_DATABASE_URL is not set',
    );
    expect(logger.warnings).toEqual([]);
  });
});
