import type { NextConfig } from 'next';
import { withSerwist } from '@serwist/turbopack';

const LEGACY_BROWSE_REDIRECTS = [
  { source: '/browse/shows', destination: '/browse/shows-trending', permanent: true },
  { source: '/browse/movies', destination: '/browse/movies-trending', permanent: true },
];

const DYNAMIC_PAGE_REUSE_SECONDS = process.env.NODE_ENV === 'production' ? 300 : 0;

const nextConfig: NextConfig = {
  reactStrictMode: true,
  expireTime: 3600,
  experimental: {
    staleTimes: { dynamic: DYNAMIC_PAGE_REUSE_SECONDS },
  },
  transpilePackages: ['@ratingo/web-core', '@ratingo/ui'],
  async redirects() {
    return LEGACY_BROWSE_REDIRECTS;
  },
  async rewrites() {
    return [
      { source: '/sw.js', destination: '/serwist/sw.js' },
      { source: '/sw.js.map', destination: '/serwist/sw.js.map' },
    ];
  },
};

export default withSerwist(nextConfig);
