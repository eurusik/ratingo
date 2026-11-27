import { QueryRefusal } from './database.constants';
import { ExplorerFailureError, ExplorerQueryRefusedError } from './database.port';
import { failureOfQuery, failureOfSchema } from './query-failure.policy';

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

describe('failureOfSchema', () => {
  it.each([
    ['57014', QueryRefusal.TIMEOUT],
    ['55P03', QueryRefusal.BUSY],
    ['53300', QueryRefusal.BUSY],
    ['42501', QueryRefusal.PRIVATE],
  ])(
    'names the refusal of a server error %s instead of calling it a failed query',
    (code, refusal) => {
      expect(failureOfSchema(errorWith(code)).reason).toBe(refusal);
    },
  );

  it('names the refusal when the call was turned away instead of calling it a failed query', () => {
    const failure = failureOfSchema(new ExplorerQueryRefusedError(QueryRefusal.BUSY, 'queue full'));

    expect(failure.reason).toBe(QueryRefusal.BUSY);
  });

  it('keeps a failure that already has a reason', () => {
    const original = new ExplorerFailureError('network');

    expect(failureOfSchema(original)).toBe(original);
  });

  it('names the error class for an unknown failure', () => {
    expect(failureOfSchema(new TypeError('secret detail')).reason).toBe('query failed (TypeError)');
  });
});
