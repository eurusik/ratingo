import type { InvestigationDraft, VerifiedAnswer } from '../entities/investigation-answer';

export const REMOVED_LINK_MARK = '[link removed]';

const CODE_FILE_SUFFIXES: ReadonlySet<string> = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'json',
  'yaml',
  'yml',
  'md',
  'sql',
  'css',
  'html',
  'env',
  'lock',
  'txt',
  'log',
  'sh',
]);

const SCHEME_LINK = /https?:\/\/[^\s<>"'`)\]]+/gi;
const BARE_HOST =
  /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.([a-z]{2,24})\b(?:\/[^\s<>"'`)\]]*)?/gi;
const TRAILING_PUNCTUATION = /[.,;:!?]+$/;

const hostOf = (link: string): string =>
  (
    link
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split(/[/?#:]/)[0] ?? ''
  ).toLowerCase();

const linksIn = (text: string): string[] => {
  const withScheme = [...text.matchAll(SCHEME_LINK)].map((match) => match[0]);
  const withoutSchemes = text.replace(SCHEME_LINK, ' ');
  const bare = [...withoutSchemes.matchAll(BARE_HOST)]
    .filter((match) => !CODE_FILE_SUFFIXES.has((match[1] ?? '').toLowerCase()))
    .map((match) => match[0]);
  return [...withScheme, ...bare].map((link) => link.replace(TRAILING_PUNCTUATION, ''));
};

export interface LinkSources {
  untrusted: string;
  trusted: string;
}

export interface LinkScrubber {
  scrub(text: string): string;
  removedCount(): number;
}

const appearsIn = (host: string, text: string): boolean => text.toLowerCase().includes(host);

const isForeign = (link: string, { untrusted, trusted }: LinkSources): boolean => {
  const host = hostOf(link);
  return host !== '' && appearsIn(host, untrusted) && !appearsIn(host, trusted);
};

export const createLinkScrubber = (sources: LinkSources): LinkScrubber => {
  let removed = 0;
  const scrub = (text: string): string => {
    let result = text;
    for (const link of [...new Set(linksIn(text))].sort((a, b) => b.length - a.length)) {
      if (!isForeign(link, sources)) continue;
      removed += result.split(link).length - 1;
      result = result.split(link).join(REMOVED_LINK_MARK);
    }
    return result;
  };
  return { scrub, removedCount: () => removed };
};

export const scrubDraft = (
  draft: InvestigationDraft,
  { scrub }: LinkScrubber,
): InvestigationDraft => ({
  answer: scrub(draft.answer),
  claims: draft.claims.map((claim) => ({ ...claim, text: scrub(claim.text) })),
  assumptions: draft.assumptions.map(scrub),
  unknowns: draft.unknowns.map(scrub),
});

export const scrubShownEvidence = (
  answer: VerifiedAnswer,
  { scrub }: LinkScrubber,
): VerifiedAnswer => ({
  ...answer,
  facts: answer.facts.map((fact) => ({
    ...fact,
    evidence: fact.evidence.map((shown) => ({ ...shown, summary: scrub(shown.summary) })),
  })),
});
