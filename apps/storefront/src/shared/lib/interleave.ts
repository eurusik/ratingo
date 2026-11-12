export function interleave<T>(first: readonly T[], second: readonly T[]): T[] {
  const length = Math.max(first.length, second.length);
  return Array.from({ length }, (_, index) => [first[index], second[index]])
    .flat()
    .filter((item): item is T => item !== undefined);
}
