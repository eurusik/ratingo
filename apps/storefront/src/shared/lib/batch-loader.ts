type FetchMany<V> = (ids: string[]) => Promise<Record<string, V>>;

interface Waiter<V> {
  resolve: (value: V | undefined) => void;
  reject: (reason: unknown) => void;
}

export interface BatchLoader<V> {
  load(id: string): Promise<V | undefined>;
}

function chunk<T>(items: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
    items.slice(index * size, (index + 1) * size),
  );
}

export function createBatchLoader<V>(
  fetchMany: FetchMany<V>,
  maxBatchSize: number,
): BatchLoader<V> {
  let queue = new Map<string, Waiter<V>[]>();

  const settle = async (ids: string[], waiters: Map<string, Waiter<V>[]>) => {
    try {
      const values = await fetchMany(ids);
      ids.forEach((id) => waiters.get(id)?.forEach((waiter) => waiter.resolve(values[id])));
    } catch (error) {
      ids.forEach((id) => waiters.get(id)?.forEach((waiter) => waiter.reject(error)));
    }
  };

  const flush = () => {
    const waiters = queue;
    queue = new Map();
    chunk([...waiters.keys()], maxBatchSize).forEach((ids) => void settle(ids, waiters));
  };

  return {
    load(id) {
      return new Promise((resolve, reject) => {
        if (queue.size === 0) queueMicrotask(flush);
        queue.set(id, [...(queue.get(id) ?? []), { resolve, reject }]);
      });
    },
  };
}
