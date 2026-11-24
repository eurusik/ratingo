export const DigestBlock = {
  PEOPLE: 'people',
  SITE: 'site',
  JOBS: 'jobs',
  SERVICES: 'services',
  STORAGE: 'storage',
} as const;
export type DigestBlock = (typeof DigestBlock)[keyof typeof DigestBlock];

export const DIGEST_BLOCK_ORDER: readonly DigestBlock[] = [
  DigestBlock.PEOPLE,
  DigestBlock.SITE,
  DigestBlock.JOBS,
  DigestBlock.SERVICES,
  DigestBlock.STORAGE,
];
