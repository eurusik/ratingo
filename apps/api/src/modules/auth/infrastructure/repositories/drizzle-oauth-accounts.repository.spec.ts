import { DrizzleOAuthAccountsRepository } from './drizzle-oauth-accounts.repository';
import * as schema from '../../../../database/schema';
import { DatabaseException } from '../../../../common/exceptions/database.exception';

describe('DrizzleOAuthAccountsRepository', () => {
  const baseRow = {
    id: 'oa-1',
    userId: 'u-1',
    provider: 'google',
    providerAccountId: 'g-123',
    email: 'test@example.com',
    displayName: 'Test User',
    avatarUrl: 'https://example.com/avatar.png',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  } as any;

  const makeDb = () => {
    const selectChain: any = {
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockResolvedValue([baseRow]),
    };
    const insertChain: any = {
      values: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([baseRow]),
    };
    const deleteWhereResult: any = {
      returning: jest.fn().mockResolvedValue([{ id: baseRow.id }]),
    };
    const deleteChain: any = {
      where: jest.fn().mockReturnValue(deleteWhereResult),
    };
    return {
      insert: jest.fn().mockReturnValue(insertChain),
      select: jest.fn().mockReturnValue(selectChain),
      delete: jest.fn().mockReturnValue(deleteChain),
      _deleteWhereResult: deleteWhereResult,
    } as any;
  };

  describe('findByProviderAccount', () => {
    it('should return mapped entity when found', async () => {
      const db = makeDb();
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByProviderAccount('google', 'g-123');

      expect(db.select).toHaveBeenCalled();
      expect(result).toMatchObject({
        id: 'oa-1',
        userId: 'u-1',
        provider: 'google',
        providerAccountId: 'g-123',
        email: 'test@example.com',
      });
    });

    it('should return null when not found', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByProviderAccount('facebook', 'fb-999');

      expect(result).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return array of mapped entities', async () => {
      const db = makeDb();
      const secondRow = { ...baseRow, id: 'oa-2', provider: 'facebook', providerAccountId: 'fb-1' };
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([baseRow, secondRow]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByUserId('u-1');

      expect(result).toHaveLength(2);
      expect(result[0].provider).toBe('google');
      expect(result[1].provider).toBe('facebook');
    });

    it('should return empty array when no accounts linked', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByUserId('u-none');

      expect(result).toEqual([]);
    });
  });

  describe('findByUserAndProvider', () => {
    it('should return mapped entity when found', async () => {
      const db = makeDb();
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByUserAndProvider('u-1', 'google');

      expect(result).toMatchObject({ id: 'oa-1', provider: 'google' });
    });

    it('should return null when not found', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByUserAndProvider('u-1', 'apple');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should insert and return mapped entity', async () => {
      const db = makeDb();
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.create({
        userId: 'u-1',
        provider: 'google',
        providerAccountId: 'g-123',
        email: 'test@example.com',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.png',
      });

      expect(db.insert).toHaveBeenCalledWith(schema.oauthAccounts);
      expect(result).toMatchObject({ id: 'oa-1', userId: 'u-1' });
    });

    it('should wrap database errors', async () => {
      const db = makeDb();
      const insertChain = db.insert();
      insertChain.returning.mockRejectedValueOnce(new Error('unique violation'));
      const repo = new DrizzleOAuthAccountsRepository(db);

      await expect(
        repo.create({
          userId: 'u-1',
          provider: 'google',
          providerAccountId: 'g-123',
          email: null,
          displayName: null,
          avatarUrl: null,
        }),
      ).rejects.toBeInstanceOf(DatabaseException);
    });
  });

  describe('deleteByUserAndProvider', () => {
    it('should return true when row was deleted', async () => {
      const db = makeDb();
      db._deleteWhereResult.returning.mockResolvedValueOnce([{ id: 'oa-1' }]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.deleteByUserAndProvider('u-1', 'google');

      expect(db.delete).toHaveBeenCalledWith(schema.oauthAccounts);
      expect(result).toBe(true);
    });

    it('should return false when no row was deleted', async () => {
      const db = makeDb();
      db._deleteWhereResult.returning.mockResolvedValueOnce([]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.deleteByUserAndProvider('u-1', 'apple');

      expect(result).toBe(false);
    });
  });

  describe('countByUserId', () => {
    it('should return count from query', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([{ count: 2 }]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.countByUserId('u-1');

      expect(result).toBe(2);
    });

    it('should return 0 when no results', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.countByUserId('u-none');

      expect(result).toBe(0);
    });

    it('should wrap database errors', async () => {
      const db = makeDb();
      const selectChain = db.select();
      selectChain.where.mockRejectedValueOnce(new Error('connection lost'));
      const repo = new DrizzleOAuthAccountsRepository(db);

      await expect(repo.countByUserId('u-1')).rejects.toBeInstanceOf(DatabaseException);
    });
  });

  describe('mapRow', () => {
    it('should map all fields including nullable ones', async () => {
      const db = makeDb();
      const rowWithNulls = {
        ...baseRow,
        email: null,
        displayName: null,
        avatarUrl: null,
      };
      const selectChain = db.select();
      selectChain.where.mockResolvedValueOnce([rowWithNulls]);
      const repo = new DrizzleOAuthAccountsRepository(db);

      const result = await repo.findByProviderAccount('google', 'g-123');

      expect(result).toMatchObject({
        email: null,
        displayName: null,
        avatarUrl: null,
      });
    });
  });
});
