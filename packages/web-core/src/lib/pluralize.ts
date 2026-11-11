/**
 * Ukrainian/Slavic pluralization utility using Intl.PluralRules API.
 *
 * @example
 * pluralize(1, { one: 'епізод', few: 'епізоди', many: 'епізодів' }) // 'епізод'
 * pluralize(3, { one: 'епізод', few: 'епізоди', many: 'епізодів' }) // 'епізоди'
 * pluralize(5, { one: 'епізод', few: 'епізоди', many: 'епізодів' }) // 'епізодів'
 */
export function pluralize(
  count: number,
  forms: { one: string; few: string; many: string },
  locale: string = 'uk',
): string {
  const pr = new Intl.PluralRules(locale);
  const rule = pr.select(count);
  return forms[rule as keyof typeof forms] ?? forms.many;
}
