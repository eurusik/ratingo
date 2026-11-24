const FLAGGED_NOTE_PREFIX = 'Не звірено з даними: ';
const FLAGGED_NOTE_MAX_NUMBERS = 5;
const SAFE_NUMBER = /^-?[\d.]+$/;
const SHOWN_NUMBER_MAX_CHARS = 16;
export const FLAGGED_NOTE_MAX_CHARS = 160;
const FLAGGED_NOTE = /\n\n<i>Не звірено з даними: [^<]*<\/i>$/u;

const shown = (number: string): string => number.slice(0, SHOWN_NUMBER_MAX_CHARS).replace('.', ',');

const noteOf = (flagged: readonly string[]): string => {
  const unique = [...new Set(flagged.filter((number) => SAFE_NUMBER.test(number)))];
  const listed = unique.slice(0, FLAGGED_NOTE_MAX_NUMBERS).map(shown).join(', ');
  const rest = unique.length - FLAGGED_NOTE_MAX_NUMBERS;
  return `<i>${FLAGGED_NOTE_PREFIX}${listed}${rest > 0 ? ` і ще ${rest}` : ''}.</i>`;
};

export const withFlaggedNumbers = (text: string, flagged: readonly string[]): string =>
  flagged.some((number) => SAFE_NUMBER.test(number)) ? `${text}\n\n${noteOf(flagged)}` : text;

export const withoutFlaggedNote = (html: string): string => html.replace(FLAGGED_NOTE, '');
