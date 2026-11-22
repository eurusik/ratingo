const ANCHOR = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
const URL_LIKE = /(?:https?:\/\/|tg:\/\/|www\.|t\.me\/)\S+/gi;
const BLANK_RUN = /[ \t]{2,}/g;

export const stripLinks = (text: string): string =>
  text.replace(ANCHOR, '$1').replace(URL_LIKE, '').replace(BLANK_RUN, ' ').trim();

export const clip = (text: string, maxChars: number): string =>
  text.length <= maxChars ? text : `${text.slice(0, maxChars - 1).trimEnd()}…`;
