import { DrizzleRefreshTokensRepository } from './drizzle-refresh-tokens.repository';
import * as schema from '../../../../database/schema';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('DrizzleRefreshTokensRepository', () => {
  const baseRow = {
    id: 'j1',
    userId: 'u1',
    tokenHash: 'hash',
    userAgent: null,
    ip: null,
    expiresAt: new Date('2025-01-10'),
    revokedAt: null,
    createdAt: new Date('2025-01-01'),
  } as any;

  const makeDb = () => {
    const chain: any = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([baseRow]),
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([baseRow]),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
    };
    return {
      insert: jest.fn().mockReturnValue(chain),
      select: jest.fn().mockReturnValue(chain),
      update: jest.fn().mockReturnValue(chain),
    } as any;
  };

  it('issue should insert token and map row', async () => {
    const db = makeDb();
    const repo = new DrizzleRefreshTokensRepository(db as any);

    const result = await repo.issue({
      id: 'j1',
      userId: 'u1',
      tokenHash: 'hash',
      userAgent: null,
      ip: null,
      expiresAt: new Date('2025-01-10'),
      revokedAt: null,
    });

    expect(db.insert).toHaveBeenCalledWith(schema.refreshTokens);
    expect((db.insert() as any).values).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'j1', userId: 'u1', tokenHash: 'hash' }),
    );
    expect(result).toMatchObject({ id: 'j1', userId: 'u1' });
  });

  it('findById should return row or null', async () => {
    const db = makeDb();
    const repo = new DrizzleRefreshTokensRepository(db as any);

    (db.select() as any).where.mockResolvedValueOnce([baseRow]);
    const found = await repo.findById('j1');
    expect(db.select).toHaveBeenCalledWith();
    expect((db.select() as any).from).toHaveBeenCalledWith(schema.refreshTokens);
    expect(found).toMatchObject({ id: 'j1' });

    (db.select() as any).where.mockResolvedValueOnce([]);
    const missing = await repo.findById('missing');
    expect(missing).toBeNull();
  });

  it('findValidByUser should filter by user, non-revoked, not expired', async () => {
    const db = makeDb();
    const repo = new DrizzleRefreshTokensRepository(db as any);

    (db.select() as any).where.mockResolvedValueOnce([baseRow]);
    const tokens = await repo.findValidByUser('u1');

    expect((db.select() as any).where).toHaveBeenCalled();
    expect(tokens).toEqual([expect.objectContaining({ id: 'j1' })]);
  });

  it('revoke should set revokedAt', async () => {
    const db = makeDb();
    const repo = new DrizzleRefreshTokensRepository(db as any);

    await repo.revoke('j1');

    expect(db.update).toHaveBeenCalledWith(schema.refreshTokens);
    expect((db.update() as any).set).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('revokeAllForUser should set revokedAt by user', async () => {
    const db = makeDb();
    const repo = new DrizzleRefreshTokensRepository(db as any);

    await repo.revokeAllForUser('u1');

    expect(db.update).toHaveBeenCalledWith(schema.refreshTokens);
    expect((db.update() as any).set).toHaveBeenCalledWith(
      expect.objectContaining({ revokedAt: expect.any(Date) }),
    );
  });

  it('issue should wrap errors into DatabaseException', async () => {
    const db = makeDb();
    (db.insert() as any).returning.mockRejectedValue(new Error('db fail'));
    const repo = new DrizzleRefreshTokensRepository(db as any);

    await expect(
      repo.issue({
        id: 'j1',
        userId: 'u1',
        tokenHash: 'h',
        userAgent: null,
        ip: null,
        expiresAt: new Date(),
        revokedAt: null,
      }),
    ).rejects.toBeInstanceOf(DatabaseException);
  });
});
