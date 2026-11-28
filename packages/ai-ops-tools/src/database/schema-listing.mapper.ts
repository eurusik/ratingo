import type { SchemaColumn, SchemaListing, SchemaTable } from './database.port';

export interface SchemaRow {
  table_name: string;
  kind: string;
  estimate: number;
  column_name: string;
  type: string;
  readable: boolean;
  enum_values: string[] | null;
}

export const SCHEMA_SQL = `
  SELECT c.relname AS table_name,
         c.relkind::text AS kind,
         c.reltuples::float8 AS estimate,
         a.attname AS column_name,
         format_type(a.atttypid, a.atttypmod) AS type,
         has_column_privilege(c.oid, a.attnum, 'SELECT') AS readable,
         (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)
            FROM pg_enum e WHERE e.enumtypid = a.atttypid) AS enum_values
  FROM pg_class c
  JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped
  WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p', 'v')
  ORDER BY c.relname, a.attnum`;

const VIEW_KIND = 'v';
const UNKNOWN_ESTIMATE = -1;

const columnOf = (row: SchemaRow): SchemaColumn => ({
  name: row.column_name,
  type: row.type,
  ...(row.enum_values === null ? {} : { enumValues: row.enum_values }),
});

const rowEstimateOf = (kind: string, estimate: number): number | null =>
  kind === VIEW_KIND || estimate <= UNKNOWN_ESTIMATE ? null : Math.round(estimate);

const tableOf = (name: string, rows: readonly SchemaRow[]): SchemaTable => {
  const readable = rows.filter((row) => row.readable);
  const [first] = rows;
  return {
    name,
    kind: first?.kind === VIEW_KIND ? 'view' : 'table',
    rowEstimate: rowEstimateOf(first?.kind ?? '', first?.estimate ?? UNKNOWN_ESTIMATE),
    columns: readable.map(columnOf),
    privateColumnCount: rows.length - readable.length,
  };
};

const groupByTable = (rows: readonly SchemaRow[]): Map<string, SchemaRow[]> => {
  const groups = new Map<string, SchemaRow[]>();
  for (const row of rows) groups.set(row.table_name, [...(groups.get(row.table_name) ?? []), row]);
  return groups;
};

export const toSchemaListing = (rows: readonly SchemaRow[]): SchemaListing => {
  const tables = [...groupByTable(rows)].map(([name, tableRows]) => tableOf(name, tableRows));
  return {
    tables: tables.filter((table) => table.columns.length > 0),
    privateTables: tables.filter((table) => table.columns.length === 0).map((table) => table.name),
  };
};
