import { type MediaType } from '../../../../common/enums/media-type.enum';

export const WEB_PAGE_CACHE_PORT = Symbol('WEB_PAGE_CACHE_PORT');

export interface WebPageCachePort {
  invalidateMediaPage(type: MediaType, slug: string): Promise<void>;
}
