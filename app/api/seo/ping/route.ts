import { NextResponse } from 'next/server';

/**
 * GET /api/seo/ping
 * Захищений ендпоїнт для сповіщення пошуковиків про оновлення sitemap.
 *
 * Авторизація:
 * - Вимагає заголовок `Authorization: Bearer <CRON_SECRET>` (якщо змінна визначена).
 *
 * Логіка:
 * - Формує URL sitemap на основі `NEXT_PUBLIC_BASE_URL`.
 * - Виконує HTTP GET до служб пінгу Google та Bing.
 *
 * Відповідь:
 * - `{ success: boolean, sitemapUrl: string, results: Array<{ url: string; status: number; ok: boolean; error?: string }> }`
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const sitemapUrl = `${baseUrl}/sitemap.xml`;

    const endpoints = [
      `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
      `https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`,
    ];

    const results = await Promise.all(
      endpoints.map(async (url) => {
        try {
          const res = await fetch(url, { method: 'GET' });
          return { url, status: res.status, ok: res.ok };
        } catch (e: any) {
          return { url, status: 0, ok: false, error: e?.message || String(e) };
        }
      })
    );

    return NextResponse.json(
      { success: true, sitemapUrl, results },
      {
        headers: { 'Cache-Control': 'no-cache' },
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
