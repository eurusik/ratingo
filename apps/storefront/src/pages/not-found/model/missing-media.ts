import type { MediaType } from '@/shared/api';

export interface MissingMedia {
  type: MediaType;
  query: string;
}

const MEDIA_PATH = /^\/(movies|shows)\/([^/]+)/;
const MEDIA_TYPES: Record<string, MediaType> = { movies: 'movie', shows: 'show' };
const NUMERIC_TOKEN = /^\d+$/;

const MULTI_LETTER_SOUNDS: ReadonlyArray<readonly [string, string]> = [
  ['shch', 'щ'],
  ['zgh', 'зг'],
  ['kh', 'х'],
  ['ts', 'ц'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['zh', 'ж'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['ye', 'є'],
  ['yi', 'ї'],
  ['yo', 'йо'],
  ['iu', 'ю'],
  ['ia', 'я'],
  ['ie', 'є'],
];

const SINGLE_LETTERS: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'ц',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'ґ',
  h: 'г',
  i: 'і',
  j: 'й',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'кс',
  y: 'и',
  z: 'з',
};

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'y']);

function isShortY(word: string, index: number): boolean {
  const previous = word[index - 1];
  const next = word[index + 1];
  return (
    previous !== undefined && VOWELS.has(previous) && (next === undefined || !VOWELS.has(next))
  );
}

function toCyrillic(word: string): string {
  let result = '';
  let index = 0;
  while (index < word.length) {
    const sound = MULTI_LETTER_SOUNDS.find(([latin]) => word.startsWith(latin, index));
    if (sound) {
      result += sound[1];
      index += sound[0].length;
      continue;
    }
    const letter = word[index];
    result += letter === 'y' && isShortY(word, index) ? 'й' : (SINGLE_LETTERS[letter] ?? letter);
    index += 1;
  }
  return result;
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export function slugToSearchQuery(slug: string): string {
  return safeDecode(slug)
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter((token) => token !== '' && !NUMERIC_TOKEN.test(token))
    .map(toCyrillic)
    .join(' ');
}

export function missingMediaAt(pathname: string): MissingMedia | null {
  const match = MEDIA_PATH.exec(pathname);
  if (!match) return null;
  const [, section, slug] = match;
  return { type: MEDIA_TYPES[section], query: slugToSearchQuery(slug) };
}
