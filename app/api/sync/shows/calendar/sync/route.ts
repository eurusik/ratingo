/**
 * GET /api/sync/calendar/sync
 * Захищений ендпоїнт: синхронізує календар ефірів для трендових шоу.
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/calendar/sync'
 *
 * Shape:
 * { success: boolean; processed: number; inserted: number; updated: number }
 */
import { NextResponse } from 'next/server';
import { runCalendarSync } from '@/lib/sync/calendar';

/**
 * Обробник GET-запиту: авторизація, запуск `runCalendarSync`,
 * повертає `{ success, processed, inserted, updated }`.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { processed, inserted, updated } = await runCalendarSync();
    return NextResponse.json({ success: true, processed, inserted, updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
