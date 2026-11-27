import fc from 'fast-check';

import { InvalidOpsInputError } from '../shared/invalid-ops-input.error';

import { DB_QUERY_MAX_SQL_CHARS } from './database.constants';
import { readOnlyStatement } from './sql-statement.policy';

const messageOf = (sql: string): string => {
  try {
    readOnlyStatement(sql);
    return 'accepted';
  } catch (error) {
    return error instanceof InvalidOpsInputError ? error.message : 'unexpected error';
  }
};

describe('readOnlyStatement', () => {
  it.each([
    ['a plain select', 'SELECT count(*) FROM users', 'SELECT count(*) FROM users'],
    ['a trailing semicolon', 'select 1;  ', 'select 1'],
    [
      'a with statement',
      'WITH a AS (SELECT 1) SELECT * FROM a',
      'WITH a AS (SELECT 1) SELECT * FROM a',
    ],
    ['leading whitespace', '\n  select 1', 'select 1'],
    ['a line comment', 'select 1 -- why\n, 2', 'select 1  \n, 2'],
    ['a block comment', 'select /* a /* nested */ b */ 1', 'select   1'],
    ['a semicolon in a string', "select ';' as x", "select ';' as x"],
    [
      'a keyword in a string',
      "select 'drop table x; insert into y' as x",
      "select 'drop table x; insert into y' as x",
    ],
    ['a keyword in a quoted name', 'select "update" from t', 'select "update" from t'],
    ['a keyword in a dollar quote', 'select $$delete from x;$$', 'select $$delete from x;$$'],
    [
      'a keyword inside a longer word',
      'select updated_at, settings, into_x from t',
      'select updated_at, settings, into_x from t',
    ],
    ['an escaped quote', "select 'it''s; ok'", "select 'it''s; ok'"],
    ['a backslash in an escape string', "select E'a\\'; b'", "select E'a\\'; b'"],
    ['a fetch clause', 'select 1 fetch first 3 rows only', 'select 1 fetch first 3 rows only'],
    ['a non-ASCII letter before a write word', 'select 1 as éinsert', 'select 1 as éinsert'],
  ])('accepts %s', (_label, sql, expected) => {
    expect(readOnlyStatement(sql)).toBe(expected);
  });

  it.each([
    ['an empty statement', '   ', 'sql must not be empty'],
    ['only a comment', '-- nothing', 'sql must not be empty'],
    [
      'a second statement',
      'select 1; select 2',
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    ],
    [
      'two semicolons',
      'select 1;;',
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    ],
    [
      'a write after a read',
      'select 1; delete from users',
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    ],
    [
      'an insert',
      'insert into genres (name) values (1)',
      'sql must be one SELECT or WITH statement',
    ],
    ['explain', 'explain select 1', 'sql must be one SELECT or WITH statement'],
    [
      'a data-changing cte',
      'with x as (delete from genres returning 1) select * from x',
      'DELETE is not allowed: this tool only reads data (use explain=true for a plan)',
    ],
    [
      'select into',
      'select * into copy_of_users from users',
      'INTO is not allowed: this tool only reads data (use explain=true for a plan)',
    ],
    [
      'a row lock',
      'select * from genres for update',
      'FOR UPDATE and FOR SHARE are not allowed: this tool only reads data',
    ],
    [
      'a no key lock',
      'select * from genres for no key update',
      'FOR UPDATE and FOR SHARE are not allowed: this tool only reads data',
    ],
    ['an unterminated string', "select 'abc", 'sql has an unterminated string'],
    ['an unterminated comment', 'select 1 /* abc', 'sql has an unterminated comment'],
    ['an unterminated quoted name', 'select "abc', 'sql has an unterminated quoted name'],
    [
      'a hidden keyword after a comment',
      'select 1 /* x */ ; /* y */ drop table users',
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    ],
    [
      'a quoted function name',
      "select \"set_config\"('work_mem', '2GB', false)",
      'set_config is not allowed: this tool only reads data',
    ],
    [
      'a second statement behind a non-ASCII name and a dollar quote',
      'select 1 as é$a$) q; commit; set statement_timeout=0; select * from (select pg_sleep(7) as é$a$',
      'sql must be exactly one statement: remove the extra ";" and everything after it',
    ],
    [
      'set_config',
      "select set_config('work_mem', '2GB', false)",
      'set_config is not allowed: this tool only reads data',
    ],
    [
      'pg_terminate_backend',
      'select pg_terminate_backend(1)',
      'pg_terminate_backend is not allowed: this tool only reads data',
    ],
    [
      'an advisory lock',
      'select pg_advisory_lock(1)',
      'pg_advisory_lock is not allowed: this tool only reads data',
    ],
    [
      'a try-advisory lock',
      'select pg_try_advisory_lock(1)',
      'pg_try_advisory_lock is not allowed: this tool only reads data',
    ],
    [
      'query_to_xml',
      "select query_to_xml('select 1', true, true, '')",
      'query_to_xml is not allowed: this tool only reads data',
    ],
    [
      'a unicode-escaped function name',
      "select U&\"set\\005fconfig\"('work_mem', '2GB', true)",
      'Unicode escapes such as U&"..." are not supported: write the characters directly',
    ],
    [
      'a unicode-escaped string',
      "select u&'a\\0041'",
      'Unicode escapes such as U&"..." are not supported: write the characters directly',
    ],
    [
      'a backslash in a quoted name',
      'select 1 as "a\\b"',
      'a quoted name must not contain a backslash',
    ],
    [
      'a numbered parameter',
      'select $1::int',
      'parameters such as $1 are not supported: write the value into the statement',
    ],
    [
      'a numbered parameter in a longer statement',
      'select id from users where id = $2',
      'parameters such as $1 are not supported: write the value into the statement',
    ],
    [
      'cursor_to_xml',
      "select cursor_to_xml('c', 1, true, true, '')",
      'cursor_to_xml is not allowed: this tool only reads data',
    ],
    [
      'table_to_xml',
      "select table_to_xml('users', true, true, '')",
      'table_to_xml is not allowed: this tool only reads data',
    ],
    [
      'table_to_xmlschema',
      "select table_to_xmlschema('users', true, true, '')",
      'table_to_xmlschema is not allowed: this tool only reads data',
    ],
    [
      'database_to_xml',
      "select database_to_xml(true, true, '')",
      'database_to_xml is not allowed: this tool only reads data',
    ],
    [
      'pg_logical_emit_message',
      "select pg_logical_emit_message(true, 'p', 'm')",
      'pg_logical_emit_message is not allowed: this tool only reads data',
    ],
  ])('refuses %s', (_label, sql, message) => {
    expect(messageOf(sql)).toBe(message);
  });

  it('refuses a statement longer than the limit', () => {
    expect(messageOf(`select '${'x'.repeat(DB_QUERY_MAX_SQL_CHARS)}'`)).toBe(
      `sql is longer than ${DB_QUERY_MAX_SQL_CHARS} characters`,
    );
  });

  describe('properties', () => {
    const WRITE_WORDS = [
      'insert',
      'update',
      'delete',
      'drop',
      'alter',
      'create',
      'truncate',
      'grant',
      'copy',
      'set',
      'call',
      'do',
    ];

    it('never accepts a statement that starts with anything but select or with', () => {
      fc.assert(
        fc.property(fc.constantFrom(...WRITE_WORDS), fc.string({ maxLength: 60 }), (word, rest) => {
          expect(messageOf(`${word} ${rest}`)).not.toBe('accepted');
        }),
      );
    });

    it('never accepts a write word after a select, wherever it hides outside quotes', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...WRITE_WORDS),
          fc.constantFrom(' ', '\n', '/**/', '(', ', '),
          fc.constantFrom('select 1', 'with a as (select 1) select * from a'),
          (word, glue, head) => {
            expect(messageOf(`${head}${glue}${word} x`)).not.toBe('accepted');
          },
        ),
      );
    });

    it('never accepts more than one statement', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('select 1', 'with a as (select 1) select * from a'),
          fc.stringMatching(/^[a-z0-9 ]{1,20}$/),
          (head, tail) => {
            fc.pre(tail.trim() !== '');
            expect(messageOf(`${head}; ${tail}`)).not.toBe('accepted');
          },
        ),
      );
    });

    it('never accepts a unicode escape, however the name or the string is spelled', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('U&"', "U&'", 'u&"', "u&'"),
          fc.stringMatching(/^[a-z0-9\\_ ]{0,20}$/),
          fc.constantFrom('select ', 'select 1, ', 'with a as (select 1) select '),
          (opening, body, head) => {
            expect(messageOf(`${head}${opening}${body}`)).toContain('Unicode escapes');
          },
        ),
      );
    });

    it('accepts any quoted text without reading keywords or semicolons inside it', () => {
      fc.assert(
        fc.property(fc.string({ maxLength: 40 }), (text) => {
          const literal = `'${text.replace(/'/g, "''")}'`;
          fc.pre(!text.includes('\\'));
          expect(messageOf(`select ${literal} as value`)).toBe('accepted');
        }),
      );
    });
  });
});
