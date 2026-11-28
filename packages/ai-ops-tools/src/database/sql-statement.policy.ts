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

const FORBIDDEN_FUNCTIONS = new Set([
  'set_config',
  'pg_terminate_backend',
  'pg_cancel_backend',
  'pg_reload_conf',
  'pg_rotate_logfile',
  'pg_logical_emit_message',
  'ts_stat',
  'ts_rewrite',
  'lo_import',
  'lo_export',
]);
const FORBIDDEN_FUNCTION_PREFIXES = [
  'pg_advisory',
  'pg_try_advisory',
  'query_to_xml',
  'cursor_to_xml',
  'table_to_xml',
  'schema_to_xml',
  'database_to_xml',
];

const ROW_LOCK_WORDS = new Set(['update', 'share', 'no', 'key']);

interface Scanned {
  code: string;
  words: string[];
  quotedNames: string[];
  semicolons: number[];
}

const FIRST_NON_ASCII_CODE_UNIT = 0x80;
const LAST_CODE_UNIT = 0xffff;
const NON_ASCII_CHARS = `${String.fromCharCode(FIRST_NON_ASCII_CODE_UNIT)}-${String.fromCharCode(LAST_CODE_UNIT)}`;

const WORD_START = new RegExp(`[A-Za-z_${NON_ASCII_CHARS}]`);
const WORD_PART = new RegExp(`[A-Za-z0-9_$${NON_ASCII_CHARS}]`);
const DOLLAR_TAG = new RegExp(
  `^\\$([A-Za-z_${NON_ASCII_CHARS}][A-Za-z0-9_${NON_ASCII_CHARS}]*)?\\$`,
);
const NON_ASCII_CHAR = new RegExp(`[${NON_ASCII_CHARS}]`);

const isWordStart = (char: string): boolean => WORD_START.test(char);
const isWordPart = (char: string): boolean => WORD_PART.test(char);

const UNICODE_ESCAPE = /^[Uu]&["']/;

const refusal = (message: string): InvalidOpsInputError => new InvalidOpsInputError(message);

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
  const match = DOLLAR_TAG.exec(sql.slice(start));
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
  const quotedNames: string[] = [];
  const semicolons: number[] = [];
  let code = '';
  let index = 0;
  let tokenEnd = 0;
  while (index < sql.length) {
    const char = sql.charAt(index);
    const startsToken = index === tokenEnd || !isWordPart(sql.charAt(index - 1));
    let next = index + 1;
    let kept = char;
    if (UNICODE_ESCAPE.test(sql.slice(index, index + 3)) && startsToken) {
      throw refusal(
        'Unicode escapes such as U&"..." are not supported: write the characters directly',
      );
    }
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
      if (kept.includes('\\')) throw refusal('a quoted name must not contain a backslash');
      quotedNames.push(kept.slice(1, -1).replace(/""/g, '"').toLowerCase());
    } else if (char === '$' && startsToken) {
      if (/[0-9]/.test(sql.charAt(index + 1))) {
        throw refusal(
          'parameters such as $1 are not supported: write the value into the statement',
        );
      }
      const tag = dollarTagAt(sql, index);
      if (tag === null && NON_ASCII_CHAR.test(sql.charAt(index + 1))) {
        throw refusal(
          'a $ followed by a non-ASCII letter is not supported: write the text without dollar quotes',
        );
      }
      if (tag !== null) {
        next = skipDollarQuoted(sql, index, tag);
        kept = sql.slice(index, next);
      }
    } else if (char === ';') {
      semicolons.push(code.length);
    } else if (isWordStart(char) && startsToken) {
      next = index;
      while (next < sql.length && isWordPart(sql.charAt(next))) next += 1;
      kept = sql.slice(index, next);
      words.push(kept.toLowerCase());
    }
    code += kept;
    if (next - index > 1 && !isWordStart(char)) tokenEnd = next;
    index = next;
  }
  return { code, words, quotedNames, semicolons };
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

const assertReadOnlyShape = (words: readonly string[], quotedNames: readonly string[]): void => {
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
  const word = words.find((candidate) => FORBIDDEN_WORDS.has(candidate));
  if (word !== undefined) {
    throw new InvalidOpsInputError(
      `${word.toUpperCase()} is not allowed: this tool only reads data (use explain=true for a plan)`,
    );
  }
  const fn = [...words, ...quotedNames].find(
    (candidate) =>
      FORBIDDEN_FUNCTIONS.has(candidate) ||
      FORBIDDEN_FUNCTION_PREFIXES.some((prefix) => candidate.startsWith(prefix)),
  );
  if (fn !== undefined) {
    throw new InvalidOpsInputError(`${fn} is not allowed: this tool only reads data`);
  }
};

export const readOnlyStatement = (sql: string): string => {
  if (sql.length > DB_QUERY_MAX_SQL_CHARS) {
    throw new InvalidOpsInputError(`sql is longer than ${DB_QUERY_MAX_SQL_CHARS} characters`);
  }
  const scanned = scan(sql);
  const statement = assertSingleStatement(scanned);
  if (statement === '') throw new InvalidOpsInputError('sql must not be empty');
  assertReadOnlyShape(scanned.words, scanned.quotedNames);
  return statement;
};
