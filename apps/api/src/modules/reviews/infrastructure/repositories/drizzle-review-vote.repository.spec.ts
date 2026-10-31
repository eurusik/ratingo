import { NotFoundException } from '../../../../common/exceptions/not-found.exception';
import { DrizzleReviewVoteRepository } from './drizzle-review-vote.repository';

/** Fake tx that records the order of operations. */
function createDb(lockRows: unknown[]) {
  const calls: string[] = [];
  const counts = [{ likesCount: 1, dislikesCount: 0 }];
  const tx = {
    select: jest.fn().mockImplementation(() => ({
      from: () => ({
        where: () => ({
          for: (mode: string) => {
            calls.push(`lock:${mode}`);
            return Promise.resolve(lockRows);
          },
        }),
      }),
    })),
    insert: jest.fn().mockImplementation(() => {
      calls.push('insert');
      return {
        values: () => ({
          onConflictDoUpdate: () => ({
            returning: () =>
              Promise.resolve([
                { id: 'v', reviewId: 'r', userId: 'u', voteType: 'like', createdAt: new Date() },
              ]),
          }),
        }),
      };
    }),
    delete: jest.fn().mockImplementation(() => {
      calls.push('delete');
      return { where: () => ({ returning: () => Promise.resolve([{ id: 'v' }]) }) };
    }),
    update: jest.fn().mockImplementation(() => {
      calls.push('recount');
      return { set: () => ({ where: () => ({ returning: () => Promise.resolve(counts) }) }) };
    }),
  };
  const db = { transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };
  return { db, calls };
}

describe('DrizzleReviewVoteRepository', () => {
  it('locks the review row (FOR UPDATE) before upserting and recounting', async () => {
    const { db, calls } = createDb([{ id: 'r' }]);
    const repo = new DrizzleReviewVoteRepository(db as never);

    const result = await repo.upsertAndRecount({
      userId: 'u',
      reviewId: 'r',
      voteType: 'like',
    } as never);

    expect(calls).toEqual(['lock:update', 'insert', 'recount']);
    expect(result.counts).toEqual({ likes: 1, dislikes: 0 });
  });

  it('locks the review row before removing a vote and recounting', async () => {
    const { db, calls } = createDb([{ id: 'r' }]);
    const repo = new DrizzleReviewVoteRepository(db as never);

    const result = await repo.removeAndRecount('u', 'r');

    expect(calls).toEqual(['lock:update', 'delete', 'recount']);
    expect(result.removed).toBe(true);
  });

  it('throws NotFoundException when the review does not exist', async () => {
    const { db, calls } = createDb([]);
    const repo = new DrizzleReviewVoteRepository(db as never);

    await expect(repo.removeAndRecount('u', 'missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(calls).toEqual(['lock:update']);
  });
});
