export interface Keyed<T> {
  item: T;
  key: string;
}

export function withOccurrenceKeys<T>(items: readonly T[], keyOf: (item: T) => string): Keyed<T>[] {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = keyOf(item);
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return { item, key: occurrence === 0 ? base : `${base}#${occurrence}` };
  });
}
