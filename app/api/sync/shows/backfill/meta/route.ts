/**
 * GET /api/sync/backfill/meta
 * Захищений ендпоїнт: бекфіл метаданих TMDB/Trakt (деталі, переклади, тощо).
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/backfill/meta'
 *
 * Shape:
 * { success: boolean; updated: number }
 */
import { NextResponse } from 'next/server';
import { runMetaBackfill, backfillShowMetaById } from '@/lib/sync/shows/backfill';

/**
 * Обробник GET-запиту: авторизація, запуск `runMetaBackfill`,
 * повертає `{ success, updated }`.
 */
/**
 * Запуск бекфілу метаданих серіалів.
 * У продакшені потребує заголовок `Authorization: Bearer CRON_SECRET`.
 *
 * @returns JSON `{ success, updated, stats }`
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const isProd = process.env.NODE_ENV === 'production';
    if (isProd && process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    const showIdParam = url.searchParams.get('showId');

    if (showIdParam && /^\d+$/.test(showIdParam)) {
      const showId = parseInt(showIdParam, 10);
      const { updated, stats } = await backfillShowMetaById(showId);
      return NextResponse.json({ success: true, updated, stats });
    }

    const { updated, stats } = await runMetaBackfill();
    return NextResponse.json({ success: true, updated, stats });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
