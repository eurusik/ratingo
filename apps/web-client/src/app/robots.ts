import type { MetadataRoute } from 'next';

import { IS_SEARCH_INDEXING_ENABLED, SEO_BASE_URL } from '@/shared/utils/seo';

const DISALLOWED_PATHS = [
  '/admin',
  '/auth',
  '/settings',
  '/api',
  '/~offline',
  '/activity',
  '/calendar',
  '/saved',
  '/notifications',
];

export default function robots(): MetadataRoute.Robots {
  if (!IS_SEARCH_INDEXING_ENABLED) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [{ userAgent: '*', allow: '/', disallow: DISALLOWED_PATHS }],
    sitemap: `${SEO_BASE_URL}/sitemap.xml`,
  };
}
