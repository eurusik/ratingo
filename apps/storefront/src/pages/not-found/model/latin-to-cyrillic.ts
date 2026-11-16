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

function soundAt(word: string, index: number): readonly [latin: string, cyrillic: string] {
  const sound = MULTI_LETTER_SOUNDS.find(([latin]) => word.startsWith(latin, index));
  if (sound) return sound;
  const letter = word[index];
  if (letter === 'y' && isShortY(word, index)) return [letter, 'й'];
  return [letter, SINGLE_LETTERS[letter] ?? letter];
}

export function toCyrillic(word: string): string {
  let result = '';
  let index = 0;
  while (index < word.length) {
    const [latin, cyrillic] = soundAt(word, index);
    result += cyrillic;
    index += latin.length;
  }
  return result;
}
