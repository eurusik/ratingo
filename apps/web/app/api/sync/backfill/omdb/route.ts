/**
 * GET /api/sync/backfill/omdb
 * Захищений ендпоїнт: бекфіл агрегованих рейтингів OMDb для шоу.
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/backfill/omdb'
 *
 * Shape:
 * { success: boolean; updated: number }
 */
import { NextResponse } from 'next/server';
import { runOmdbBackfill } from '@/lib/sync/backfill';

/**
 * Обробник GET-запиту: авторизація, запуск `runOmdbBackfill`,
 * повертає `{ success, updated }`.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { updated } = await runOmdbBackfill();
    return NextResponse.json({ success: true, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
