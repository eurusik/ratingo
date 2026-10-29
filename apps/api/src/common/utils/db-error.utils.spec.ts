import { HttpStatus, Logger } from '@nestjs/common';

import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from '../exceptions/app.exception';
import {
  DatabaseConflictException,
  DatabaseException,
  DatabaseInvalidInputException,
} from '../exceptions/database.exception';
import { NotFoundException } from '../exceptions/not-found.exception';

import { withDbError } from './db-error.utils';

/** Mimics drizzle-orm 0.44 DrizzleQueryError wrapping a postgres.js PostgresError. */
function drizzleError(pg: Record<string, unknown>, params = 'secret@example.com,hunter2') {
  const cause = Object.assign(new Error(String(pg.message ?? 'pg error')), pg);
  const wrapper = new Error(`Failed query: insert into "users" values ($1, $2)\nparams: ${params}`);
  (wrapper as Error & { cause?: unknown }).cause = cause;
  return wrapper;
}

describe('withDbError', () => {
  let logger: Logger;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    logger = new Logger('test');
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
  });

  it('returns the result on success', async () => {
    await expect(withDbError('op', logger, async () => 42)).resolves.toBe(42);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('re-throws AppException as-is', async () => {
    const err = new NotFoundException();
    await expect(
      withDbError('op', logger, async () => {
        throw err;
      }),
    ).rejects.toBe(err);
  });

  it('maps unique violation (23505, via Drizzle cause) to 409 and keeps DatabaseException', async () => {
    const original = drizzleError({
      code: '23505',
      message: 'duplicate key value violates unique constraint "users_email_key"',
      constraint_name: 'users_email_key',
      table_name: 'users',
      detail: 'Key (email)=(a@b.c) already exists.',
    });

    const thrown = await withDbError('create user', logger, async () => {
      throw original;
    }).catch((e) => e);

    expect(thrown).toBeInstanceOf(DatabaseConflictException);
    expect(thrown).toBeInstanceOf(DatabaseException);
    expect(thrown).toBeInstanceOf(AppException);
    expect(thrown.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(thrown.code).toBe(ErrorCode.RESOURCE_CONFLICT);
    expect(thrown.cause).toBe(original);
  });

  it.each(['22P02', '23503'])('maps %s to 400', async (code) => {
    const thrown = await withDbError('op', logger, async () => {
      throw drizzleError({ code, message: 'pg' });
    }).catch((e) => e);

    expect(thrown).toBeInstanceOf(DatabaseInvalidInputException);
    expect(thrown).toBeInstanceOf(DatabaseException);
    expect(thrown.getStatus()).toBe(HttpStatus.BAD_REQUEST);
    expect(thrown.code).toBe(ErrorCode.INVALID_INPUT);
  });

  it('keeps DatabaseException 500 for other pg errors and plain errors', async () => {
    for (const err of [drizzleError({ code: '40001', message: 'serialization' }), new Error('x')]) {
      const thrown = await withDbError('read thing', logger, async () => {
        throw err;
      }).catch((e) => e);

      expect(thrown).toBeInstanceOf(DatabaseException);
      expect(thrown).not.toBeInstanceOf(DatabaseConflictException);
      expect(thrown.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(thrown.code).toBe(ErrorCode.DATABASE_ERROR);
      expect(thrown.message).toBe('Failed to read thing');
    }
  });

  it('also maps a top-level (unwrapped) pg error', async () => {
    const thrown = await withDbError('op', logger, async () => {
      throw Object.assign(new Error('dup'), { code: '23505' });
    }).catch((e) => e);

    expect(thrown).toBeInstanceOf(DatabaseConflictException);
  });

  it('logs pg code/constraint/table/detail from the unwrapped error', async () => {
    await withDbError(
      'create user',
      logger,
      async () => {
        throw drizzleError({
          code: '23505',
          message: 'duplicate key',
          constraint_name: 'users_email_key',
          table_name: 'users',
          detail: 'Key (email) already exists.',
        });
      },
      { userId: 'u1' },
    ).catch(() => undefined);

    const [line] = errorSpy.mock.calls[0];
    expect(line).toContain('"pgCode":"23505"');
    expect(line).toContain('"constraint":"users_email_key"');
    expect(line).toContain('"table":"users"');
    expect(line).toContain('"pgDetail":"Key (email) already exists."');
    expect(line).toContain('"userId":"u1"');
  });

  it('never logs bound query params (message or stack)', async () => {
    await withDbError('create user', logger, async () => {
      throw drizzleError({ code: '23505', message: 'duplicate key' });
    }).catch(() => undefined);

    const [line, stack] = errorSpy.mock.calls[0];
    expect(line).not.toContain('hunter2');
    expect(line).not.toContain('secret@example.com');
    expect(String(stack)).not.toContain('hunter2');
  });

  it('strips params from the message of non-wrapped drizzle-style errors', async () => {
    await withDbError('op', logger, async () => {
      throw new Error('Failed query: select 1\nparams: hunter2');
    }).catch(() => undefined);

    expect(errorSpy.mock.calls[0][0]).not.toContain('hunter2');
  });

  it('does not leak params through the thrown exception stack', async () => {
    const thrown = await withDbError('op', logger, async () => {
      throw drizzleError({ code: '40001', message: 'serialization' });
    }).catch((e) => e);

    expect(String(thrown.stack)).not.toContain('hunter2');
  });
});
