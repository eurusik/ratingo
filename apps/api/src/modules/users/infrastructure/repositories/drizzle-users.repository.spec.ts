import { PgDialect } from 'drizzle-orm/pg-core';
import { DrizzleUsersRepository } from './drizzle-users.repository';
import * as schema from '../../../../database/schema';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('DrizzleUsersRepository', () => {
  const baseRow = {
    id: 'u1',
    email: 'user@example.com',
    username: 'ratingo_fan',
    passwordHash: 'hash',
    avatarUrl: null,
    bio: null,
    location: null,
    website: null,
    preferredLanguage: null,
    preferredRegion: null,
    isProfilePublic: true,
    showWatchHistory: true,
    showRatings: true,
    allowFollowers: true,
    role: 'user',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  } as any;

  const makeDb = () => {
    const chain: any = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([baseRow]),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
    };
    return {
      insert: jest.fn().mockReturnValue(chain),
      update: jest.fn().mockReturnValue(chain),
    } as any;
  };

  it('create should apply defaults for profile flags', async () => {
    const db = makeDb();
    const repo = new DrizzleUsersRepository(db as any);

    const result = await repo.create({
      email: 'user@example.com',
      username: 'ratingo_fan',
      passwordHash: 'hash',
    });

    expect(db.insert).toHaveBeenCalledWith(schema.users);
    // Defaults
    expect((db.insert() as any).values).toHaveBeenCalledWith(
      expect.objectContaining({
        isProfilePublic: true,
        showWatchHistory: true,
        showRatings: true,
        allowFollowers: true,
      }),
    );
    expect(result).toMatchObject({ id: 'u1', email: 'user@example.com' });
  });

  it('updateProfile should only set provided fields', async () => {
    const db = makeDb();
    const repo = new DrizzleUsersRepository(db as any);

    const result = await repo.updateProfile('u1', { username: 'new' });

    expect(db.update).toHaveBeenCalledWith(schema.users);
    expect((db.update() as any).set).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'new', updatedAt: expect.any(Date) }),
    );
    // undefined fields should not be set
    const setPayload = (db.update() as any).set.mock.calls[0][0];
    expect(setPayload).not.toHaveProperty('bio');
    expect(result).toMatchObject({ username: 'ratingo_fan' });
  });

  it('updateProfile should wrap errors into DatabaseException', async () => {
    const db = makeDb();
    (db.update() as any).returning.mockRejectedValue(new Error('db failure'));
    const repo = new DrizzleUsersRepository(db as any);

    await expect(repo.updateProfile('u1', { username: 'x' })).rejects.toBeInstanceOf(
      DatabaseException,
    );
  });

  describe('case-insensitive lookups', () => {
    const makeSelectDb = (rows: any[]) => {
      const chain: any = {
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue(rows),
      };
      // findByEmail awaits the chain after where(); make it thenable
      chain.then = (resolve: (v: any[]) => void) => resolve(rows);
      return { db: { select: jest.fn().mockReturnValue(chain) } as any, chain };
    };

    it('findByEmail should match with lower(email) = lower($1)', async () => {
      const { db, chain } = makeSelectDb([baseRow]);
      const repo = new DrizzleUsersRepository(db);

      const user = await repo.findByEmail('User@Example.com');

      expect(user).toMatchObject({ id: 'u1' });
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
      expect(whereSql).toBe('lower("users"."email") = lower($1)');
      expect(params).toEqual(['User@Example.com']);
    });

    it('findByUsername should match case-insensitively and return a single row', async () => {
      const { db, chain } = makeSelectDb([baseRow]);
      const repo = new DrizzleUsersRepository(db);

      const user = await repo.findByUsername('Ratingo_Fan');

      expect(user).toMatchObject({ id: 'u1', username: 'ratingo_fan' });
      const { sql: whereSql, params } = new PgDialect().sqlToQuery(chain.where.mock.calls[0][0]);
      expect(whereSql).toBe('lower("users"."username") = lower($1)');
      expect(params).toEqual(['Ratingo_Fan']);
      expect(chain.limit).toHaveBeenCalledWith(1);
    });

    it('findByUsername should return null when nothing matches', async () => {
      const { db } = makeSelectDb([]);
      const repo = new DrizzleUsersRepository(db);

      await expect(repo.findByUsername('nobody')).resolves.toBeNull();
    });
  });
});
