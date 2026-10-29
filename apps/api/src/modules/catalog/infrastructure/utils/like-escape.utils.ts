/**
 * Escapes LIKE/ILIKE wildcards (`%`, `_`) and the escape character itself (`\\`)
 * so user input is matched literally. PostgreSQL uses backslash as the default escape.
 */
export function escapeLikePattern(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&');
}
