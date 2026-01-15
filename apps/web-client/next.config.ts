import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.railway.app',
        pathname: '/**',
      },
    ],
  },
  transpilePackages: ['@ratingo/api-contract'],
};

export default nextConfig;
