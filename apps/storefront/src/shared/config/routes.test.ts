import { isBrowsePath, mediaReviewsRoute } from './routes';

describe('isBrowsePath', () => {
  it.each([
    ['/browse', true],
    ['/browse/shows-trending', true],
    ['/browse-later', false],
    ['/shows/klinika', false],
    ['/', false],
  ])('treats %s as browse: %s', (pathname, expected) => {
    expect(isBrowsePath(pathname)).toBe(expected);
  });
});

describe('mediaReviewsRoute', () => {
  it('nests the reviews list under the title page', () => {
    expect(mediaReviewsRoute('movie', 'dune-part-two')).toBe('/movies/dune-part-two/reviews');
    expect(mediaReviewsRoute('show', 'андор')).toBe(`/shows/${encodeURIComponent('андор')}/reviews`);
  });
});
