export function searchableText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/\p{Diacritic}/gu, '');
}

export function isSearchQuery(query: string): boolean {
  return query.trim() !== '';
}

export function matchesSearch(text: string, query: string): boolean {
  const needle = searchableText(query.trim());
  return needle === '' || searchableText(text).includes(needle);
}
