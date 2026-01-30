import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  expireTime: 3600,
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  turbopack: {
    root: __dirname,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        port: '',
        pathname: '/t/p/**',
      },
    ],
  },
};

export default nextConfig;
