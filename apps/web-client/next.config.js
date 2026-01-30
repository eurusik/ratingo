/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  expireTime: 3600,
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  images: {
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
  transpilePackages: ['@ratingo/api-contract'],
};

module.exports = nextConfig;
