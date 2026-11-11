import en from './locales/en.json';
import uk from './locales/uk.json';
import { getDictionary } from './dictionaries';

function keyPaths(node: unknown, prefix = ''): string[] {
  if (typeof node !== 'object' || node === null) return [prefix];
  return Object.entries(node).flatMap(([key, value]) =>
    keyPaths(value, prefix ? `${prefix}.${key}` : key),
  );
}

describe('dictionaries', () => {
  it('gives English exactly the keys of the Ukrainian source dictionary', () => {
    expect(keyPaths(en).sort()).toEqual(keyPaths(uk).sort());
  });

  it.each([
    ['uk', uk],
    ['en', en],
  ])('has no empty strings in %s', (_locale, dictionary) => {
    expect(JSON.stringify(dictionary)).not.toMatch(/:\s*""/);
  });

  it('defaults to Ukrainian', () => {
    expect(getDictionary()).toBe(getDictionary('uk'));
    expect(getDictionary('en').home.subtitle).toBe(en.home.subtitle);
  });
});
