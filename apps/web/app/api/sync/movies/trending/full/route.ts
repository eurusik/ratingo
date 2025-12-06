import { NextResponse } from 'next/server';
import { runTrendingMoviesSync } from '@/lib/sync/trendingMovies';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const result = await runTrendingMoviesSync();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
/**
 * GET /api/sync/movies/trending/full
 * Повний одноразовий синк трендів фільмів для порожньої або неповної бази даних.
 *
 * Використання: лише з авторизацією CRON_SECRET
 * @example
 * curl -H "Authorization: Bearer $CRON_SECRET" 'https://ratingo.top/api/sync/movies/trending/full'
 */
