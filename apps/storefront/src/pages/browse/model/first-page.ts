import type { CatalogPage } from '@/shared/api';
import type { GridMedia } from './grid-media';

export type FirstPageResult =
  | { status: 'loaded'; page: CatalogPage<GridMedia> }
  | { status: 'failed' };
