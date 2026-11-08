/**
 * Shared test utilities for mocking Drizzle ORM.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Creates a chainable thenable mock for Drizzle-like fluent API.
 * Used in unit tests to mock database operations.
 *
 * @param resolveWith - Value to resolve the promise with
 * @param rejectWith - Error to reject the promise with (optional)
 * @param extraMethods - Additional chain methods to mock
 * @returns Chainable mock object
 *
 * @example
 * const selectChain = createDrizzleThenable([{ id: '1' }]);
 * const db = { select: jest.fn().mockReturnValue(selectChain) };
 */
export function createDrizzleThenable(
  resolveWith: any = [],
  rejectWith?: Error,
  extraMethods: string[] = [],
): any {
  const thenable: any = {};

  const chainMethods = [
    'insert',
    'values',
    'onConflictDoUpdate',
    'onConflictDoNothing',
    'update',
    'set',
    'where',
    'select',
    'from',
    'innerJoin',
    'leftJoin',
    'limit',
    'offset',
    'orderBy',
    'groupBy',
    'having',
    'returning',
    ...extraMethods,
  ];

  chainMethods.forEach((method) => {
    thenable[method] = jest.fn().mockReturnValue(thenable);
  });

  if (rejectWith) {
    thenable.then = (_res: any, rej: any) => Promise.reject(rejectWith).catch(rej);
  } else {
    thenable.then = (res: any) => Promise.resolve(resolveWith).then(res);
  }

  return thenable;
}
