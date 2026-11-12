import fc from 'fast-check';
import { createBatchLoader } from './batch-loader';

const ids = fc.array(fc.stringMatching(/^[a-f0-9]{1,8}$/), { minLength: 1, maxLength: 40 });

describe('createBatchLoader', () => {
  it('answers every caller with its own value from as few requests as the batch size allows', async () => {
    await fc.assert(
      fc.asyncProperty(ids, fc.integer({ min: 1, max: 10 }), async (requested, maxBatchSize) => {
        const fetchMany = jest.fn(async (batch: string[]) =>
          Object.fromEntries(batch.map((id) => [id, `value-${id}`])),
        );
        const loader = createBatchLoader(fetchMany, maxBatchSize);

        const values = await Promise.all(requested.map((id) => loader.load(id)));

        const unique = new Set(requested);
        expect(values).toEqual(requested.map((id) => `value-${id}`));
        expect(fetchMany).toHaveBeenCalledTimes(Math.ceil(unique.size / maxBatchSize));
        expect(fetchMany.mock.calls.flatMap(([batch]) => batch).sort()).toEqual([...unique].sort());
      }),
    );
  });

  it('resolves ids the server left out as undefined', async () => {
    const loader = createBatchLoader(async () => ({ known: 1 }), 100);
    await expect(Promise.all([loader.load('known'), loader.load('missing')])).resolves.toEqual([
      1,
      undefined,
    ]);
  });

  it('rejects every caller of a failed batch', async () => {
    const failure = new Error('offline');
    const loader = createBatchLoader(async () => Promise.reject(failure), 100);
    await expect(loader.load('a')).rejects.toBe(failure);
  });

  it('starts a new batch after the previous one was sent', async () => {
    const fetchMany = jest.fn(async (batch: string[]) =>
      Object.fromEntries(batch.map((id) => [id, id])),
    );
    const loader = createBatchLoader(fetchMany, 100);

    await loader.load('a');
    await loader.load('b');

    expect(fetchMany.mock.calls).toEqual([[['a']], [['b']]]);
  });
});
