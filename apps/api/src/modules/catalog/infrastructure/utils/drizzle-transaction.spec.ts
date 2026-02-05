import { toDrizzleTx } from './drizzle-transaction';

describe('drizzle-transaction', () => {
  describe('toDrizzleTx', () => {
    it('should return the same object cast to DrizzleTransaction', () => {
      const mockTx = {
        insert: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        select: jest.fn(),
      };

      const result = toDrizzleTx(mockTx);

      expect(result).toBe(mockTx);
    });

    it('should preserve all transaction methods', () => {
      const mockInsert = jest.fn();
      const mockUpdate = jest.fn();
      const mockTx = {
        insert: mockInsert,
        update: mockUpdate,
      };

      const result = toDrizzleTx(mockTx);

      expect(result.insert).toBe(mockInsert);
      expect(result.update).toBe(mockUpdate);
    });

    it('should work with any object shape (abstract transaction)', () => {
      // Domain layer passes abstract DatabaseTransaction type
      const abstractTx = { customMethod: jest.fn() } as unknown;

      const result = toDrizzleTx(abstractTx);

      expect(result).toBe(abstractTx);
    });
  });
});
