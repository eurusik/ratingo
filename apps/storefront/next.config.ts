import path from 'node:path';
import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

const DEFAULT_ADMIN_ORIGIN = 'https://admin.ratingo.top';
const TRAILING_SLASHES = /\/+$/;
const ADMIN_ORIGIN = (process.env.ADMIN_ORIGIN?.trim() || DEFAULT_ADMIN_ORIGIN).replace(
  TRAILING_SLASHES,
  '',
);

const LEGACY_REDIRECTS = [
  { source: '/browse/shows', destination: '/browse/shows-trending', permanent: true },
  { source: '/browse/movies', destination: '/browse/movies-trending', permanent: true },
  { source: '/saved', destination: '/my?list=plan', permanent: false },
  {
    source: '/activity',
    has: [{ type: 'query' as const, key: 'tab', value: 'history' }],
    destination: '/my?list=history',
    permanent: false,
  },
  { source: '/activity', destination: '/my', permanent: false },
];

const HIDDEN_UNTIL_PORTED = [
  { source: '/journal', destination: '/', permanent: false },
  { source: '/journal/:path*', destination: '/', permanent: false },
  { source: '/about', destination: '/', permanent: false },
];

const MOVED_TO_ADMIN_HOST = [
  { source: '/admin', destination: `${ADMIN_ORIGIN}/admin`, permanent: false },
  { source: '/admin/:path*', destination: `${ADMIN_ORIGIN}/admin/:path*`, permanent: false },
];

const DYNAMIC_PAGE_REUSE_SECONDS = process.env.NODE_ENV === 'production' ? 300 : 0;

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../..'),
  reactStrictMode: true,
  expireTime: 3600,
  experimental: {
    staleTimes: { dynamic: DYNAMIC_PAGE_REUSE_SECONDS },
    isrFlushToDisk: false,
  },
  transpilePackages: ['@ratingo/web-core', '@ratingo/ui', '@ratingo/node-telemetry'],
  async redirects() {
    return [...LEGACY_REDIRECTS, ...HIDDEN_UNTIL_PORTED, ...MOVED_TO_ADMIN_HOST];
  },
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
  async rewrites() {
    return [
      { source: '/sw.js', destination: '/serwist/sw.js' },
      { source: '/sw.js.map', destination: '/serwist/sw.js.map' },
    ];
  },
};

export default withSerwist(nextConfig);
