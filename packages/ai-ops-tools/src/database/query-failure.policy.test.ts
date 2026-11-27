import { QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';
import { failureOfQuery } from './query-failure.policy';

const errorWith = (code: string, message = 'text'): Error =>
  Object.assign(new Error(message), { code });

describe('failureOfQuery', () => {
  it.each([
    ['42501', QueryRefusal.PRIVATE],
    ['57014', QueryRefusal.TIMEOUT],
    ['55P03', QueryRefusal.BUSY],
    ['53300', QueryRefusal.BUSY],
    ['42P01', QueryRefusal.NOT_FOUND],
    ['42703', QueryRefusal.NOT_FOUND],
    ['42883', QueryRefusal.NOT_FOUND],
    ['42601', QueryRefusal.INVALID_QUERY],
    ['42804', QueryRefusal.INVALID_QUERY],
    ['22P02', QueryRefusal.INVALID_QUERY],
    ['25006', QueryRefusal.INVALID_QUERY],
  ])('maps SQLSTATE %s to %s', (code, refusal) => {
    const failure = failureOfQuery(errorWith(code));

    expect(failure).toBeInstanceOf(ExplorerQueryRefusedError);
    expect((failure as ExplorerQueryRefusedError).refusal).toBe(refusal);
  });

  it.each([
    ['ECONNREFUSED', 'network'],
    ['CONNECT_TIMEOUT', 'network'],
    ['CONNECTION_CLOSED', 'network'],
    ['28P01', 'access_denied'],
  ])('maps %s to an unavailable reason %s', (code, reason) => {
    const failure = failureOfQuery(errorWith(code));

    expect(failure).toBeInstanceOf(ExplorerFailureError);
    expect((failure as ExplorerFailureError).reason).toBe(reason);
  });

  it('names the error class for an unknown failure and never leaks its text', () => {
    const failure = failureOfQuery(new TypeError('secret detail'));

    expect((failure as ExplorerFailureError).reason).toBe('query failed (TypeError)');
  });

  it('keeps the database message of a refusal on one line and short', () => {
    const failure = failureOfQuery(
      errorWith('42501', `permission denied\nfor table ${'x'.repeat(500)}`),
    );

    expect((failure as ExplorerQueryRefusedError).message.length).toBeLessThanOrEqual(300);
    expect((failure as ExplorerQueryRefusedError).message).not.toContain('\n');
  });
});
