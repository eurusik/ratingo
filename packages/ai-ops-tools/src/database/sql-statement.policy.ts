import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';

import { DB_QUERY_MAX_SQL_CHARS } from './database.constants';

const STATEMENT_STARTS = new Set(['select', 'with']);

const FORBIDDEN_WORDS = new Set([
  'insert',
  'update',
  'delete',
  'merge',
  'into',
  'truncate',
  'drop',
  'alter',
  'create',
  'grant',
  'revoke',
  'copy',
  'call',
  'do',
  'set',
  'reset',
  'lock',
  'vacuum',
  'analyze',
  'listen',
  'notify',
  'begin',
  'commit',
  'rollback',
  'execute',
  'prepare',
  'explain',
]);

const ROW_LOCK_WORDS = new Set(['update', 'share', 'no', 'key']);

interface Scanned {
  code: string;
  words: string[];
  semicolons: number[];
}

const isWordStart = (char: string): boolean => /[A-Za-z_]/.test(char);
const isWordPart = (char: string): boolean => /[A-Za-z0-9_$]/.test(char);

const unterminated = (what: string): InvalidOpsInputError =>
  new InvalidOpsInputError(`sql has an unterminated ${what}`);

const skipBlockComment = (sql: string, start: number): number => {
  let depth = 0;
  let index = start;
  while (index < sql.length) {
    if (sql.startsWith('/*', index)) {
      depth += 1;
      index += 2;
    } else if (sql.startsWith('*/', index)) {
      depth -= 1;
      index += 2;
      if (depth === 0) return index;
    } else {
      index += 1;
    }
  }
  throw unterminated('comment');
};

const skipQuoted = (sql: string, start: number, quote: string, backslash: boolean): number => {
  let index = start + 1;
  while (index < sql.length) {
    const char = sql.charAt(index);
    if (backslash && char === '\\') {
      index += 2;
    } else if (char === quote) {
      if (sql.charAt(index + 1) === quote) index += 2;
      else return index + 1;
    } else {
      index += 1;
    }
  }
  throw unterminated(quote === "'" ? 'string' : 'quoted name');
};

const dollarTagAt = (sql: string, start: number): string | null => {
  const match = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(start));
  return match === null ? null : match[0];
};

const skipDollarQuoted = (sql: string, start: number, tag: string): number => {
  const end = sql.indexOf(tag, start + tag.length);
  if (end === -1) throw unterminated('string');
  return end + tag.length;
};

const afterEscapeStringPrefix = (sql: string, quoteAt: number): boolean => {
  const prefix = sql.charAt(quoteAt - 1);
  return (prefix === 'e' || prefix === 'E') && !isWordPart(sql.charAt(quoteAt - 2));
};

const scan = (sql: string): Scanned => {
  const words: string[] = [];
  const semicolons: number[] = [];
  let code = '';
  let index = 0;
  while (index < sql.length) {
    const char = sql.charAt(index);
    let next = index + 1;
    let kept = char;
    if (sql.startsWith('--', index)) {
      const lineEnd = sql.indexOf('\n', index);
      next = lineEnd === -1 ? sql.length : lineEnd;
      kept = ' ';
    } else if (sql.startsWith('/*', index)) {
      next = skipBlockComment(sql, index);
      kept = ' ';
    } else if (char === "'") {
      next = skipQuoted(sql, index, "'", afterEscapeStringPrefix(sql, index));
      kept = sql.slice(index, next);
    } else if (char === '"') {
      next = skipQuoted(sql, index, '"', false);
      kept = sql.slice(index, next);
    } else if (char === '$' && !isWordPart(sql.charAt(index - 1))) {
      const tag = dollarTagAt(sql, index);
      if (tag !== null) {
        next = skipDollarQuoted(sql, index, tag);
        kept = sql.slice(index, next);
      }
    } else if (char === ';') {
      semicolons.push(code.length);
    } else if (isWordStart(char) && !isWordPart(sql.charAt(index - 1))) {
      next = index;
      while (next < sql.length && isWordPart(sql.charAt(next))) next += 1;
      kept = sql.slice(index, next);
      words.push(kept.toLowerCase());
    }
    code += kept;
    index = next;
  }
  return { code, words, semicolons };
};

const assertSingleStatement = ({ code, semicolons }: Scanned): string => {
  const [first] = semicolons;
  if (first === undefined) return code.trim();
  const afterFirst = code.slice(first + 1);
  if (semicolons.length > 1 || afterFirst.trim() !== '') {
    throw new InvalidOpsInputError(
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    );
  }
  return code.slice(0, first).trim();
};

const assertReadOnlyShape = (words: readonly string[]): void => {
  const [first] = words;
  if (first === undefined || !STATEMENT_STARTS.has(first)) {
    throw new InvalidOpsInputError('sql must be one SELECT or WITH statement');
  }
  const locking = words.findIndex(
    (word, index) => word === 'for' && ROW_LOCK_WORDS.has(words[index + 1] ?? ''),
  );
  if (locking !== -1) {
    throw new InvalidOpsInputError(
      'FOR UPDATE and FOR SHARE are not allowed: this tool only reads data',
    );
  }
  const forbidden = words.find((word) => FORBIDDEN_WORDS.has(word));
  if (forbidden !== undefined) {
    throw new InvalidOpsInputError(
      `${forbidden.toUpperCase()} is not allowed: this tool only reads data (use explain=true for a plan)`,
    );
  }
};

export const readOnlyStatement = (sql: string): string => {
  if (sql.length > DB_QUERY_MAX_SQL_CHARS) {
    throw new InvalidOpsInputError(`sql is longer than ${DB_QUERY_MAX_SQL_CHARS} characters`);
  }
  const scanned = scan(sql);
  const statement = assertSingleStatement(scanned);
  if (statement === '') throw new InvalidOpsInputError('sql must not be empty');
  assertReadOnlyShape(scanned.words);
  return statement;
};
