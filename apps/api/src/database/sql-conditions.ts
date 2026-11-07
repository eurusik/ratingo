import { and, or, type SQL } from 'drizzle-orm';

export function anyOf(first: SQL, ...rest: SQL[]): SQL {
  return or(first, ...rest) ?? first;
}

export function allOf(first: SQL, ...rest: SQL[]): SQL {
  return and(first, ...rest) ?? first;
}
