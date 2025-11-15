/**
 * GET /api/sync/trending/status
 * Захищений ендпоїнт: повертає останню джобу трендів і підсумки по задачах
 * (`pending/processing/done/error`).
 *
 * @example curl -H "Authorization: Bearer $CRON_SECRET" 'http://localhost:3000/api/sync/trending/status'
 */
import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

/**
 * Обробник GET-запиту: авторизація, пошук останньої `sync_job`,
 * підрахунок задач за статусами і JSON-відповідь.
 */
export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const jobRows = await db
      .select({
        id: syncJobs.id,
        status: syncJobs.status,
        stats: syncJobs.stats,
        createdAt: syncJobs.createdAt,
        updatedAt: syncJobs.updatedAt,
      })
      .from(syncJobs)
      .where(eq(syncJobs.type, 'trending'))
      .orderBy(desc(syncJobs.createdAt))
      .limit(1);
    const job = jobRows[0] || null;
    if (!job) {
      return NextResponse.json({
        success: true,
        job: null,
        tasks: { total: 0, pending: 0, processing: 0, done: 0, error: 0 },
      });
    }
    const jobId = job.id as number;
    const q = async (status: string) => {
      const r = await db
        .select({ c: sql<any>`count(*)` })
        .from(syncTasks)
        .where(and(eq(syncTasks.jobId, jobId), eq(syncTasks.status, status)));
      const v = r[0]?.c;
      const n = Number(typeof v === 'bigint' ? Number(v) : String(v));
      return Number.isFinite(n) ? n : 0;
    };
    const [pending, processing, done, error] = await Promise.all([
      q('pending'),
      q('processing'),
      q('done'),
      q('error'),
    ]);
    const total = Number(pending) + Number(processing) + Number(done) + Number(error);
    if (pending === 0 && processing === 0 && job.status !== 'done') {
      await db
        .update(syncJobs)
        .set({ status: 'done', updatedAt: new Date() })
        .where(eq(syncJobs.id, jobId));
      job.status = 'done' as any;
      (job as any).updatedAt = new Date();
    }
    return NextResponse.json({
      success: true,
      job,
      tasks: { total, pending, processing, done, error },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
