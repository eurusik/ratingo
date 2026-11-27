import { DB_QUERY_CELL_HARD_MAX_CHARS } from './database.constants';

const HIGH_SURROGATE = /[\uD800-\uDBFF]$/;

const shortened = (text: string, what: string): string => {
  if (text.length <= DB_QUERY_CELL_HARD_MAX_CHARS) return text;
  const head = text.slice(0, DB_QUERY_CELL_HARD_MAX_CHARS).replace(HIGH_SURROGATE, '');
  return `${head}... [${what} cut, ${text.length} characters in total]`;
};

const structuredCell = (value: object): unknown => {
  const json = JSON.stringify(value);
  return json.length > DB_QUERY_CELL_HARD_MAX_CHARS ? shortened(json, 'json') : value;
};

export const cellOf = (value: unknown): unknown => {
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Uint8Array) return `[binary, ${value.byteLength} bytes]`;
  if (typeof value === 'string') return shortened(value, 'text');
  if (typeof value === 'object' && value !== null) return structuredCell(value);
  return value;
};

export const rowOf = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([name, value]) => [name, cellOf(value)]));
