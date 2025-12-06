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
import { runMetaBackfill } from '@/lib/sync/backfill';

/**
 * Обробник GET-запиту: авторизація, запуск `runMetaBackfill`,
 * повертає `{ success, updated }`.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { updated } = await runMetaBackfill();
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
