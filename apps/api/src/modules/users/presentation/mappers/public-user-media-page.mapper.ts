import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { type PublicUserMediaPage } from '@/modules/users/domain/read-models/public-user-media-list';

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

  return {
    data: page.data,
    meta: {
      count: page.data.length,
      total: page.total,
      limit,
      offset,
      hasMore: offset + page.data.length < page.total,
    },
  };
}
