import { DEFAULT_PAGE_SIZE } from '@/common/constants';
import { MediaType } from '@/common/enums/media-type.enum';

import { type PublicUserMediaListItem } from '@/modules/users/domain/read-models/public-user-media-list';

import { toPaginatedPublicUserMediaResponseDto } from './public-user-media-page.mapper';

describe('toPaginatedPublicUserMediaResponseDto', () => {
  const makeItem = (id: string): PublicUserMediaListItem => ({
    id,
    state: 'completed',
    rating: 80,
    progress: null,
    notes: null,
    createdAt: new Date('2020-01-01T00:00:00.000Z'),
    updatedAt: new Date('2020-01-02T00:00:00.000Z'),
    mediaSummary: {
      id: `media-${id}`,
      type: MediaType.MOVIE,
      title: 'Title',
      slug: 'title',
      poster: null,
    },
  });

  it('passes items through and uses default limit and offset when query is absent', () => {
    const data = [makeItem('1'), makeItem('2')];

    const result = toPaginatedPublicUserMediaResponseDto({ total: 5, data });

    expect(result.data).toBe(data);
    expect(result.meta).toEqual({
      count: 2,
      total: 5,
      limit: DEFAULT_PAGE_SIZE,
      offset: 0,
      hasMore: true,
    });
  });

  it('reports no more pages when offset plus count reaches total', () => {
    const result = toPaginatedPublicUserMediaResponseDto(
      { total: 3, data: [makeItem('3')] },
      { limit: 2, offset: 2 },
    );

    expect(result.meta).toEqual({ count: 1, total: 3, limit: 2, offset: 2, hasMore: false });
  });

  it('reports more pages when items remain past the current page', () => {
    const result = toPaginatedPublicUserMediaResponseDto(
      { total: 4, data: [makeItem('1'), makeItem('2')] },
      { limit: 2, offset: 0 },
    );

    expect(result.meta.hasMore).toBe(true);
  });
});
