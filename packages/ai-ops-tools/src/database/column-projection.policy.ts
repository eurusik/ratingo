import { DB_QUERY_CELL_MAX_CHARS, QueryRefusal } from './database.constants';
import { ExplorerQueryRefusedError } from './database.port';

export interface OutputColumn {
  name: string;
  type: number;
}

const TypeOid = {
  BOOL: 16,
  BYTEA: 17,
  INT8: 20,
  INT2: 21,
  INT4: 23,
  OID: 26,
  FLOAT4: 700,
  FLOAT8: 701,
  MONEY: 790,
  DATE: 1082,
  TIME: 1083,
  TIMESTAMP: 1114,
  TIMESTAMPTZ: 1184,
  INTERVAL: 1186,
  TIMETZ: 1266,
  NUMERIC: 1700,
  UUID: 2950,
} as const;

const FIXED_SIZE_TYPES: ReadonlySet<number> = new Set([
  TypeOid.BOOL,
  TypeOid.INT8,
  TypeOid.INT2,
  TypeOid.INT4,
  TypeOid.OID,
  TypeOid.FLOAT4,
  TypeOid.FLOAT8,
  TypeOid.MONEY,
  TypeOid.DATE,
  TypeOid.TIME,
  TypeOid.TIMESTAMP,
  TypeOid.TIMESTAMPTZ,
  TypeOid.INTERVAL,
  TypeOid.TIMETZ,
  TypeOid.UUID,
]);
const UNNAMED_COLUMN = '?column?';

const quoted = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const cutNote = (column: string, length: string): string =>
  `left(${column}::text, ${DB_QUERY_CELL_MAX_CHARS}) || '... [cut, ' || ${length} || ' characters in total]'`;

const boundedExpression = (name: string): string => {
  const column = quoted(name);
  const length = `char_length(${column}::text)`;
  return `CASE WHEN ${length} > ${DB_QUERY_CELL_MAX_CHARS} THEN to_jsonb(${cutNote(column, length)}) ELSE to_jsonb(${column}) END`;
};

const boundedText = (name: string): string => {
  const column = quoted(name);
  const length = `char_length(${column}::text)`;
  return `CASE WHEN ${length} > ${DB_QUERY_CELL_MAX_CHARS} THEN ${cutNote(column, length)} ELSE ${column}::text END`;
};

const expressionOf = ({ name, type }: OutputColumn): string => {
  if (FIXED_SIZE_TYPES.has(type)) return quoted(name);
  if (type === TypeOid.NUMERIC) return boundedText(name);
  if (type === TypeOid.BYTEA) return `'[binary, ' || octet_length(${quoted(name)}) || ' bytes]'`;
  return boundedExpression(name);
};

const duplicatesIn = (names: readonly string[]): string[] => [
  ...new Set(names.filter((name, index) => names.indexOf(name) !== index)),
];

export const assertNamedColumns = (columns: readonly OutputColumn[]): void => {
  const names = columns.map((column) => column.name);
  const duplicates = duplicatesIn(names);
  const unnamed = names.includes(UNNAMED_COLUMN);
  if (duplicates.length === 0 && !unnamed) return;
  const problems = [
    ...(unnamed ? ['a column without a name'] : []),
    ...(duplicates.length > 0 ? [`repeated names (${duplicates.join(', ')})`] : []),
  ];
  throw new ExplorerQueryRefusedError(
    QueryRefusal.INVALID_QUERY,
    `every output column needs its own name, but the query has ${problems.join(' and ')}: add AS <name> to each expression`,
  );
};

export const boundedSelect = (
  columns: readonly OutputColumn[],
  sql: string,
  rowLimit: number,
): string =>
  `SELECT ${columns.map((column) => `${expressionOf(column)} AS ${quoted(column.name)}`).join(', ')} FROM (${sql}) AS explorer_result LIMIT ${rowLimit + 1}`;
