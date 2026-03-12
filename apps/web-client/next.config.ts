import { spawnSync } from 'node:child_process';
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';

const revision =
  spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8' }).stdout?.trim() ?? crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  additionalPrecacheEntries: [{ url: '/~offline', revision }],
  disable: process.env.NODE_ENV === 'development',
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // CDN stale-while-revalidate: serve stale for 1 hour max (default is 1 year)
  expireTime: 3600,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'img.ratingo.top',
        pathname: '/tmdb/**',
      },
      {
        protocol: 'https',
        hostname: 'static.tvmaze.com',
        pathname: '/uploads/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.railway.app',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@ratingo/api-contract', '@ratingo/fx-engine'],
  // Serwist adds webpack config for SW bundling; empty turbopack config
  // tells Next.js 16 this is intentional and allows dev to use Turbopack
  turbopack: {},
};

export default withSerwist(nextConfig);
