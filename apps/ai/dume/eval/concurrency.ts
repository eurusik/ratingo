export const mapWithLimit = async <T>(items: readonly T[], limit: number, work: (item: T) => Promise<void>): Promise<void> => {
  let next = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await work(item as T);
    }
  });
  await Promise.all(lanes);
};
