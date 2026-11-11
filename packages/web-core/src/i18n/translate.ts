export function getByPath(dict: object, path: string): string {
  let result: unknown = dict;

  for (const key of path.split('.')) {
    if (result && typeof result === 'object' && key in result) {
      result = (result as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }

  return typeof result === 'string' ? result : path;
}
