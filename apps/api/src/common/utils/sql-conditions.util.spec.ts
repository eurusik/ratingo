import { PgDialect } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

import { allOf, anyOf } from './sql-conditions.util';

describe('anyOf', () => {
  const dialect = new PgDialect();

  it('joins conditions with OR', () => {
    const query = dialect.sqlToQuery(anyOf(sql`a = 1`, sql`b = 2`));

    expect(query.sql).toBe('(a = 1 or b = 2)');
  });

  it('returns a single condition unchanged in meaning', () => {
    const query = dialect.sqlToQuery(anyOf(sql`a = 1`));

    expect(query.sql).toBe('a = 1');
  });
});

describe('allOf', () => {
  const dialect = new PgDialect();

  it('joins conditions with AND', () => {
    const query = dialect.sqlToQuery(allOf(sql`a = 1`, sql`b = 2`));

    expect(query.sql).toBe('(a = 1 and b = 2)');
  });
});
