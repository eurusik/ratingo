import { DB_QUERY_CELL_MAX_CHARS, QueryRefusal } from './database.constants';
import { ExplorerQueryRefusedError } from './database.port';

export interface OutputColumn {
  name: string;
  type: number;
}

const FIXED_SIZE_TYPES = new Set([
  16, 20, 21, 23, 26, 700, 701, 790, 1082, 1083, 1114, 1184, 1186, 1266, 1700, 2950,
]);
const BYTEA = 17;
const UNNAMED_COLUMN = '?column?';

const quoted = (name: string): string => `"${name.replace(/"/g, '""')}"`;

const boundedExpression = (name: string): string => {
  const column = quoted(name);
  const length = `char_length(${column}::text)`;
  return `CASE WHEN ${length} > ${DB_QUERY_CELL_MAX_CHARS} THEN to_jsonb(left(${column}::text, ${DB_QUERY_CELL_MAX_CHARS}) || '... [cut, ' || ${length} || ' characters in total]') ELSE to_jsonb(${column}) END`;
};

const expressionOf = ({ name, type }: OutputColumn): string => {
  if (FIXED_SIZE_TYPES.has(type)) return quoted(name);
  if (type === BYTEA) return `'[binary, ' || octet_length(${quoted(name)}) || ' bytes]'`;
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
