import type { NextConfig } from 'next';
import nextConfig from '../next.config';

jest.mock('@serwist/turbopack', () => ({ withSerwist: (config: NextConfig) => config }));

interface Redirect {
  source: string;
  destination: string;
  permanent: boolean;
  has?: unknown[];
}

async function loadRedirects(): Promise<Redirect[]> {
  return (await nextConfig.redirects!()) as Redirect[];
}

async function redirectFrom(source: string): Promise<Redirect> {
  const matches = (await loadRedirects()).filter(
    (redirect) => redirect.source === source && !redirect.has,
  );
  expect(matches).toHaveLength(1);
  return matches[0];
}

describe('legacy redirects', () => {
  it.each([
    ['/browse/shows', '/browse/shows-trending', true],
    ['/browse/movies', '/browse/movies-trending', true],
    ['/saved', '/my?list=plan', false],
    ['/activity', '/my', false],
    ['/journal', '/', false],
    ['/journal/:path*', '/', false],
    ['/about', '/', false],
    ['/admin', 'https://admin.ratingo.top/admin', false],
    ['/admin/:path*', 'https://admin.ratingo.top/admin/:path*', false],
  ])('redirects %s to %s', async (source, destination, permanent) => {
    expect(await redirectFrom(source)).toMatchObject({ destination, permanent });
  });

  it('opens the history list for the old activity history tab, ahead of the plain rule', async () => {
    const activity = (await loadRedirects()).filter((redirect) => redirect.source === '/activity');
    expect(activity).toEqual([
      {
        source: '/activity',
        has: [{ type: 'query', key: 'tab', value: 'history' }],
        destination: '/my?list=history',
        permanent: false,
      },
      { source: '/activity', destination: '/my', permanent: false },
    ]);
  });
});
