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

/**
 * Creates a mock database object with common Drizzle methods.
 *
 * @param options - Configuration for mock behavior
 * @returns Mock database object
 *
 * @example
 * const { db, chains } = createMockDatabase({ selectResult: [{ id: '1' }] });
 * expect(db.select).toHaveBeenCalled();
 */
export function createMockDatabase(
  options: {
    selectResult?: any;
    insertResult?: any;
    updateResult?: any;
    deleteResult?: any;
    rejectWith?: Error;
  } = {},
) {
  const selectChain = createDrizzleThenable(options.selectResult ?? [], options.rejectWith);
  const insertChain = createDrizzleThenable(options.insertResult ?? [], options.rejectWith);
  const updateChain = createDrizzleThenable(options.updateResult ?? [], options.rejectWith);
  const deleteChain = createDrizzleThenable(options.deleteResult ?? [], options.rejectWith);

  const db = {
    select: jest.fn().mockReturnValue(selectChain),
    insert: jest.fn().mockReturnValue(insertChain),
    update: jest.fn().mockReturnValue(updateChain),
    delete: jest.fn().mockReturnValue(deleteChain),
    transaction: jest.fn(async (cb: (tx: any) => Promise<any>) =>
      cb({
        select: db.select,
        insert: db.insert,
        update: db.update,
        delete: db.delete,
      }),
    ),
  };

  return {
    db,
    chains: {
      select: selectChain,
      insert: insertChain,
      update: updateChain,
      delete: deleteChain,
    },
  };
}
