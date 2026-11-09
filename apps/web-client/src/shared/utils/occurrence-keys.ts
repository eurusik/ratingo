export interface KeyedItem<T> {
  item: T;
  key: string;
}

export function withOccurrenceKeys<T>(
  items: readonly T[],
  toBaseKey: (item: T) => string,
): KeyedItem<T>[] {
  const occurrencesByBaseKey = new Map<string, number>();
  return items.map((item) => {
    const baseKey = toBaseKey(item);
    const occurrence = occurrencesByBaseKey.get(baseKey) ?? 0;
    occurrencesByBaseKey.set(baseKey, occurrence + 1);
    return { item, key: `${baseKey}#${occurrence}` };
  });
}
