export const DigestLevel = {
  ACTION: 'action',
  NOTE: 'note',
  OK: 'ok',
} as const;
export type DigestLevel = (typeof DigestLevel)[keyof typeof DigestLevel];

export const DIGEST_LEVEL_RANK: Readonly<Record<DigestLevel, number>> = {
  [DigestLevel.OK]: 0,
  [DigestLevel.NOTE]: 1,
  [DigestLevel.ACTION]: 2,
};
