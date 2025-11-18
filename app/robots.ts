import type { MetadataRoute } from 'next';

/**
 * Генератор robots.txt для App Router.
 *
 * Політика індексації:
 * - Дозволяє індексацію всіх сторінок сайту (`allow: '/'`).
 * - Забороняє індексацію API-роутів (`/api`, `/api/*`).
 *
 * Sitemap:
 * - Вказує абсолютне посилання на `sitemap.xml`.
 *
 * @returns Об'єкт конфігурації `MetadataRoute.Robots`.
 */
export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api', '/api/*'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
