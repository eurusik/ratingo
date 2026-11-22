export const DigestBlock = {
  PEOPLE: 'people',
  JOBS: 'jobs',
  SERVICES: 'services',
  STORAGE: 'storage',
} as const;
export type DigestBlock = (typeof DigestBlock)[keyof typeof DigestBlock];

export const DIGEST_BLOCK_ORDER: readonly DigestBlock[] = [
  DigestBlock.PEOPLE,
  DigestBlock.JOBS,
  DigestBlock.SERVICES,
  DigestBlock.STORAGE,
];
