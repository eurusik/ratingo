import { DigestBlock } from './digest-block.constants';

export const DigestSource = {
  PRODUCT: 'product',
  QUEUES: 'queues',
  API_KEYS: 'api_keys',
  HTTP_ERRORS: 'http_errors',
  BACKUP: 'backup',
  INFRA: 'infra',
  SCHEDULER: 'scheduler',
} as const;
export type DigestSource = (typeof DigestSource)[keyof typeof DigestSource];

export const OPTIONAL_SOURCES: readonly DigestSource[] = [
  DigestSource.PRODUCT,
  DigestSource.SCHEDULER,
];

export const SOURCE_BLOCK: Readonly<Record<DigestSource, DigestBlock>> = {
  [DigestSource.PRODUCT]: DigestBlock.PEOPLE,
  [DigestSource.QUEUES]: DigestBlock.JOBS,
  [DigestSource.SCHEDULER]: DigestBlock.JOBS,
  [DigestSource.API_KEYS]: DigestBlock.SERVICES,
  [DigestSource.HTTP_ERRORS]: DigestBlock.SERVICES,
  [DigestSource.BACKUP]: DigestBlock.STORAGE,
  [DigestSource.INFRA]: DigestBlock.STORAGE,
};

export const SOURCE_LABEL: Readonly<Record<DigestSource, string>> = {
  [DigestSource.PRODUCT]: 'люди',
  [DigestSource.QUEUES]: 'черги',
  [DigestSource.API_KEYS]: 'ключі',
  [DigestSource.HTTP_ERRORS]: 'запити до сервісів',
  [DigestSource.BACKUP]: 'бекап',
  [DigestSource.INFRA]: 'база і Redis',
  [DigestSource.SCHEDULER]: 'нічні завдання',
};
