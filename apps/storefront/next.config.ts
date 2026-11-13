import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  expireTime: 3600,
  transpilePackages: ['@ratingo/web-core'],
};

export default nextConfig;
