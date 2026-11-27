export const UKRAINIAN_LETTERS = 'А-Яа-яІіЇїЄєҐґ';
export const PLACEHOLDER_EPISODE_TITLE_PATTERN = '^\\s*([Сс]ерія|[Ее]пізод)\\s*[0-9]+\\s*$';

const NON_UKRAINIAN_LETTER = new RegExp(`[^${UKRAINIAN_LETTERS}]`, 'g');
const NON_LETTER = /[^\p{L}]/gu;
const PLACEHOLDER_EPISODE_TITLE = new RegExp(PLACEHOLDER_EPISODE_TITLE_PATTERN);

function isMostlyUkrainian(text: string): boolean {
  const ukrainian = text.replace(NON_UKRAINIAN_LETTER, '').length;
  return ukrainian > 0 && ukrainian * 2 >= text.replace(NON_LETTER, '').length;
}

export function pickUkrainianText(text: string | null | undefined): string | null {
  const trimmed = text?.trim();
  return trimmed && isMostlyUkrainian(trimmed) ? trimmed : null;
}

export function pickUkrainianEpisodeTitle(title: string | null | undefined): string | null {
  const text = pickUkrainianText(title);
  return text && !PLACEHOLDER_EPISODE_TITLE.test(text) ? text : null;
}
