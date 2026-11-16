import { isBrowsePath, isSettingsPath, mediaReviewsRoute, showSeasonRoute } from './routes';

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

describe('isSettingsPath', () => {
  it.each([
    ['/settings', true],
    ['/settings/privacy', true],
    ['/settings-old', false],
    ['/my', false],
  ])('treats %s as settings: %s', (pathname, expected) => {
    expect(isSettingsPath(pathname)).toBe(expected);
  });
});

describe('mediaReviewsRoute', () => {
  it('nests the reviews list under the title page', () => {
    expect(mediaReviewsRoute('movie', 'dune-part-two')).toBe('/movies/dune-part-two/reviews');
    expect(mediaReviewsRoute('show', 'андор')).toBe(
      `/shows/${encodeURIComponent('андор')}/reviews`,
    );
  });
});

describe('showSeasonRoute', () => {
  it('links to a season of the show when one is given', () => {
    expect(showSeasonRoute('arcane')).toBe('/shows/arcane');
    expect(showSeasonRoute('arcane', 2)).toBe('/shows/arcane?season=2');
  });
});
