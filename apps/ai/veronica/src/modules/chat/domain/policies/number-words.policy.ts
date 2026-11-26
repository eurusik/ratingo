const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const TEEN_LIMIT = ONES.length;
const BASE = 10;
const HUNDRED = 100;

export const MAX_SPELLED_NUMBER = HUNDRED - 1;

export const spellNumber = (value: number): string | null => {
  if (!Number.isInteger(value) || value < 0 || value > MAX_SPELLED_NUMBER) return null;
  if (value < TEEN_LIMIT) return ONES[value];
  const tens = TENS[Math.floor(value / BASE)];
  const ones = value % BASE;
  return ones === 0 ? tens : `${tens}-${ONES[ones]}`;
};
