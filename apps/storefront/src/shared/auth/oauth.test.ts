import fc from 'fast-check';
import { buildOAuthStartUrl, toSafeReturnPath } from './oauth';

describe('toSafeReturnPath', () => {
  it.each(['/', '/browse/movies', '/settings?tab=security', '/saved#top'])(
    'keeps the relative path %s',
    (path) => {
      expect(toSafeReturnPath(path)).toBe(path);
    },
  );

  it.each([
    null,
    undefined,
    '',
    'https://evil.example',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    'javascript:alert(1)',
    'settings',
  ])('falls back to the home page for %p', (candidate) => {
    expect(toSafeReturnPath(candidate)).toBe('/');
  });

  it('always returns a same-origin path', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'binary' }), (candidate) => {
        const resolved = new URL(toSafeReturnPath(candidate), 'https://ratingo.top');
        expect(resolved.origin).toBe('https://ratingo.top');
      }),
    );
  });
});

describe('buildOAuthStartUrl', () => {
  it('passes the return path and this frontend origin to the API', () => {
    const url = new URL(
      buildOAuthStartUrl({
        apiBaseUrl: 'https://api-dev.ratingo.top/api',
        provider: 'google',
        returnTo: '/saved?tab=watchlist',
        returnOrigin: 'https://storefront-dev.ratingo.top',
      }),
    );

    expect(url.origin + url.pathname).toBe('https://api-dev.ratingo.top/api/auth/google');
    expect(url.searchParams.get('returnTo')).toBe('/saved?tab=watchlist');
    expect(url.searchParams.get('returnOrigin')).toBe('https://storefront-dev.ratingo.top');
  });

  it('replaces an unsafe return path with the home page', () => {
    const url = new URL(
      buildOAuthStartUrl({
        apiBaseUrl: 'https://api-dev.ratingo.top/api',
        provider: 'facebook',
        returnTo: '//evil.example',
        returnOrigin: 'https://storefront-dev.ratingo.top',
      }),
    );

    expect(url.searchParams.get('returnTo')).toBe('/');
  });
});
