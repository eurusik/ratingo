import fc from 'fast-check';
import { REVIEW_SORTS, parseReviewSort, reviewSortSearch } from './review-sort';

describe('review sort in the URL', () => {
  it('falls back to the most helpful order for anything unknown', () => {
    fc.assert(
      fc.property(fc.option(fc.string(), { nil: undefined }), (value) => {
        expect(REVIEW_SORTS).toContain(parseReviewSort(value));
      }),
    );
    expect(parseReviewSort(null)).toBe('most_liked');
    expect(parseReviewSort('popular')).toBe('most_liked');
  });

  it('round-trips every sort through the query string', () => {
    for (const sort of REVIEW_SORTS) {
      const search = new URLSearchParams(reviewSortSearch(sort));
      expect(parseReviewSort(search.get('sort'))).toBe(sort);
    }
    expect(reviewSortSearch('most_liked')).toBe('');
  });
});
