export function firstOrUndefined<T>(items: readonly T[]): T | undefined {
  return items[0];
}
