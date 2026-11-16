import type { CatalogPage } from '@/shared/api';
import type { GridMedia } from '@/entities/media';

export type FirstPageResult =
  { status: 'loaded'; page: CatalogPage<GridMedia> } | { status: 'failed' };
