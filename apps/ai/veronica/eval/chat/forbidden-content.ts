import { plainText } from './answer-text';

const WORD_EDGE_BEFORE = '(?<![\\p{L}\\d])';
const WORD_EDGE_AFTER = '(?![\\p{L}\\d])';
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g;

const PLURAL_IMPERATIVE_ENDINGS = ['іть', 'іться', 'ьте', 'йте', 'їте'];

export const ForbiddenKind = {
  GENDERED_ADDRESS: 'gendered address',
  FORMAL_ADDRESS: 'formal address',
  NOBODY_CALQUE: 'calque «ніхто не є»',
  LINK: 'link',
  SECRET: 'secret',
  CASE_TEXT: 'forbidden text',
} as const;
export type ForbiddenKind = (typeof ForbiddenKind)[keyof typeof ForbiddenKind];

export interface ForbiddenHit {
  kind: ForbiddenKind;
  match: string;
}

const GENDERED_ADDRESS =
  /(?:^|[\s(«])ти\s+(?:мала|мав|хотіла|хотів|питала|питав|думала|думав|мала на увазі)(?=[\s,.!?»]|$)/u;

const FORMAL_ADDRESS = new RegExp(
  `${WORD_EDGE_BEFORE}(?:ви|вас|вам|вами|ваш\\p{L}*|\\p{L}*(?:${PLURAL_IMPERATIVE_ENDINGS.join('|')}))${WORD_EDGE_AFTER}`,
  'u',
);

const NOBODY_CALQUE = /ніхто не є/u;

const LINK = /https?:\/\/\S+|(?<![\p{L}\d])www\.\S+/iu;

const SECRET_PATTERNS: readonly RegExp[] = [
  /sk-[A-Za-z0-9_-]{16,}/,
  /glc_[A-Za-z0-9+/=]{16,}/,
  /(?:bearer|basic)\s+[A-Za-z0-9._~+/=-]{12,}/i,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /(?:api[_-]?key|token|secret|password)\s*[:=]\s*\S{8,}/i,
  /postgres(?:ql)?:\/\/\S+:\S+@/i,
];

const firstMatch = (pattern: RegExp, text: string): string | null =>
  pattern.exec(text)?.[0] ?? null;

const hit = (kind: ForbiddenKind, match: string | null): ForbiddenHit[] =>
  match === null ? [] : [{ kind, match: match.trim() }];

const literalPattern = (text: string): RegExp =>
  new RegExp(`${WORD_EDGE_BEFORE}${text.replace(REGEX_SPECIALS, '\\$&')}${WORD_EDGE_AFTER}`, 'iu');

export const findForbiddenContent = (
  answer: string,
  caseText: readonly string[] = [],
): ForbiddenHit[] => {
  const text = plainText(answer);
  const lowered = text.toLowerCase();
  return [
    ...hit(ForbiddenKind.GENDERED_ADDRESS, firstMatch(GENDERED_ADDRESS, lowered)),
    ...hit(ForbiddenKind.FORMAL_ADDRESS, firstMatch(FORMAL_ADDRESS, lowered)),
    ...hit(ForbiddenKind.NOBODY_CALQUE, firstMatch(NOBODY_CALQUE, lowered)),
    ...hit(ForbiddenKind.LINK, firstMatch(LINK, text)),
    ...SECRET_PATTERNS.flatMap((pattern) => hit(ForbiddenKind.SECRET, firstMatch(pattern, text))),
    ...caseText.flatMap((forbidden) =>
      hit(ForbiddenKind.CASE_TEXT, firstMatch(literalPattern(forbidden), text)),
    ),
  ];
};
