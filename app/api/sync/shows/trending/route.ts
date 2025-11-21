/**
 * GET /api/sync/trending
 * Захищений ендпоїнт (Bearer `CRON_SECRET`) для формування черги задач
 * трендів: створює `sync_job` і `sync_tasks` без тривалої обробки.
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/trending'
 */
import { NextResponse } from 'next/server';
import { runTrendingCoordinator } from '@/lib/sync/trendingCoordinator';

/**
 * Обробник GET-запиту: перевіряє авторизацію, запускає координатор
 * і повертає `{ success, jobId, tasksQueued }`.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const result = await runTrendingCoordinator();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Trakt API unavailable') ? 503 : 500;
    return NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status }
    );
  }
}
