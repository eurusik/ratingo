import { isBrowsePath } from './routes';

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
