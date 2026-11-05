import { DEFAULT_PAGE_SIZE } from '@/common/constants';

import { type PublicUserMediaPage } from '../../domain/read-models/public-user-media-list';
import {
  type PaginatedPublicUserMediaResponseDto,
  type PublicUserMediaListQueryDto,
} from '../dto/public-user-media.dto';

export function toPaginatedPublicUserMediaResponseDto(
  page: PublicUserMediaPage,
  query?: PublicUserMediaListQueryDto,
): PaginatedPublicUserMediaResponseDto {
  const limit = query?.limit ?? DEFAULT_PAGE_SIZE;
  const offset = query?.offset ?? 0;
  const items = page.data;

  return {
    data: items,
    meta: {
      count: items.length,
      total: page.total,
      limit,
      offset,
      hasMore: offset + items.length < page.total,
    },
  };
}
