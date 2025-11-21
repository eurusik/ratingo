/**
 * GET /api/sync/trending/full
 * Повний одноразовий синк трендів для порожньої або неповної бази даних.
 *
 * Робить повний цикл:
 * - Отримує трендові шоу з Trakt
 * - Для кожного шоу викликає обробку (створення/оновлення запису у `shows`, рейтинги, спарклайни)
 * - OMDb backfill для карток
 * - TMDB meta backfill (базові поля)
 * - Синхронізація календаря ефірів і прибирання застарілих ефірів
 *
 * Використання: лише з авторизацією CRON_SECRET
 * @example
 * curl -H "Authorization: Bearer $CRON_SECRET" 'https://ratingo.top/api/sync/trending/full'
 *
 * Відповідь: об'єкт із підсумками виконання (added/updated, backfill, calendar, snapshots, perf, errors)
 */
import { NextResponse } from 'next/server';
import { runTrendingSync } from '@/lib/sync/trending';

/**
 * Обробник GET-запиту: перевіряє авторизацію і запускає повний синк.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(200, parseInt(String(limitParam || '50'), 10) || 50));
    const result = await runTrendingSync({ limit });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
