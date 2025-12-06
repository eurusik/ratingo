import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

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
export const dynamic = 'force-dynamic';

async function resolveBaseUrl(): Promise<string> {
  const envBase = process.env.NEXT_PUBLIC_SITE_URL;
  if (envBase && !envBase.includes('localhost')) return envBase;
  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host');
  const proto = hdrs.get('x-forwarded-proto') || 'https';
  if (host) return `${proto}://${host}`;
  return envBase || 'http://localhost:3000';
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const baseUrl = await resolveBaseUrl();
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
