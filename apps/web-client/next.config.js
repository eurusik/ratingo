/** @type {import('next').NextConfig} */
const nextConfig = {
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
};

module.exports = nextConfig;
