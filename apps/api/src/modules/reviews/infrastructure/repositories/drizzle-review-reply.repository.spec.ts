import { DrizzleReviewReplyRepository } from './drizzle-review-reply.repository';

/**
 * Builds a fake Drizzle db whose transaction callback receives a tx that records
 * which tables were updated and returns the configured rows from `.returning()`.
 */
function createDb(returningRows: unknown[]) {
  const updates: string[] = [];
  const tx = {
    insert: jest.fn().mockReturnValue({
      values: jest.fn().mockReturnValue({
        returning: jest.fn().mockResolvedValue([{ id: 'reply-1', reviewId: 'review-1' }]),
      }),
    }),
    update: jest.fn().mockImplementation(() => {
      updates.push('update');
      return {
        set: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            returning: jest.fn().mockResolvedValue(returningRows),
            then: (resolve: (v: undefined) => void) => resolve(undefined),
          }),
        }),
      };
    }),
  };
  const db = { transaction: jest.fn(async (cb: (t: typeof tx) => unknown) => cb(tx)) };
  return { db, tx, updates };
}

describe('DrizzleReviewReplyRepository', () => {
  it('create inserts the reply and bumps the review counter in one transaction', async () => {
    const { db, tx, updates } = createDb([]);
    const repo = new DrizzleReviewReplyRepository(db as never);

    const reply = await repo.create({
      reviewId: 'review-1',
      userId: 'user-1',
      content: 'hi',
    } as never);

    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(tx.insert).toHaveBeenCalledTimes(1);
    expect(updates).toHaveLength(1);
    expect(reply).toMatchObject({ id: 'reply-1' });
  });

  it('softDelete decrements the counter only when a row was actually updated', async () => {
    const won = createDb([{ reviewId: 'review-1' }]);
    await expect(new DrizzleReviewReplyRepository(won.db as never).softDelete('r')).resolves.toBe(
      true,
    );
    expect(won.updates).toHaveLength(2); // reply + review counter

    const lost = createDb([]);
    await expect(new DrizzleReviewReplyRepository(lost.db as never).softDelete('r')).resolves.toBe(
      false,
    );
    expect(lost.updates).toHaveLength(1); // only the conditional reply update
  });
});
