import { toSchemaListing, type SchemaRow } from './schema-listing.mapper';

const row = (overrides: Partial<SchemaRow>): SchemaRow => ({
  table_name: 'users',
  kind: 'r',
  estimate: 120.4,
  column_name: 'id',
  type: 'uuid',
  readable: true,
  enum_values: null,
  ...overrides,
});

describe('toSchemaListing', () => {
  it('lists readable columns, counts the hidden ones and rounds the estimate', () => {
    const listing = toSchemaListing([
      row({}),
      row({ column_name: 'role', type: 'user_role', enum_values: ['user', 'admin'] }),
      row({ column_name: 'email', type: 'text', readable: false }),
    ]);

    expect(listing).toEqual({
      tables: [
        {
          name: 'users',
          kind: 'table',
          rowEstimate: 120,
          columns: [
            { name: 'id', type: 'uuid' },
            { name: 'role', type: 'user_role', enumValues: ['user', 'admin'] },
          ],
          privateColumnCount: 1,
        },
      ],
      privateTables: [],
    });
  });

  it('names a table with no readable column as private and leaves it out of the tables', () => {
    const listing = toSchemaListing([
      row({ table_name: 'oauth_accounts', column_name: 'email', readable: false }),
      row({ table_name: 'genres', column_name: 'name', type: 'text' }),
    ]);

    expect(listing.privateTables).toEqual(['oauth_accounts']);
    expect(listing.tables.map((table) => table.name)).toEqual(['genres']);
  });

  it('gives a view and a never-analysed table no row estimate', () => {
    const listing = toSchemaListing([
      row({ table_name: 'public_media_items', kind: 'v', estimate: 0 }),
      row({ table_name: 'new_table', estimate: -1 }),
    ]);

    expect(listing.tables.map((table) => [table.kind, table.rowEstimate])).toEqual([
      ['view', null],
      ['table', null],
    ]);
  });
});
