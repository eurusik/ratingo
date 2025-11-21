/**
 * GET /api/sync/calendar/prune
 * Захищений ендпоїнт: очищає застарілі ефіри, що втратили зв’язок з трендами.
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/calendar/prune'
 *
 * Shape:
 * { success: boolean; deleted: number }
 */
import { NextResponse } from 'next/server';
import { pruneStaleAirings } from '@/lib/sync/calendar';

/**
 * Обробник GET-запиту: авторизація, запуск `pruneStaleAirings`,
 * повертає `{ success, deleted }`.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const { deleted } = await pruneStaleAirings();
    return NextResponse.json({ success: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
