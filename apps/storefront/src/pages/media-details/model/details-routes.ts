import type { MediaType } from '@/shared/api';
import { BROWSE_ROUTE } from '@/shared/config';

const BROWSE_CATEGORY_BY_TYPE: Record<MediaType, string> = {
  movie: 'movies-trending',
  show: 'shows-trending',
};

export function browseHrefFor(type: MediaType): string {
  return `${BROWSE_ROUTE}/${BROWSE_CATEGORY_BY_TYPE[type]}`;
}
