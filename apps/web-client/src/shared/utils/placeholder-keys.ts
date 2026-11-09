export function createPlaceholderKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, position) => `${prefix}-${position}`);
}
