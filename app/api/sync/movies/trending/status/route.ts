import { NextResponse } from 'next/server';
import { db } from '@/db';
import { syncJobs, syncTasks } from '@/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

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
      .where(eq(syncJobs.type, 'trending_movies'))
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
    const rows = await db
      .select({
        pending: sql<any>`count(*) FILTER (WHERE ${syncTasks.status} = 'pending')`,
        processing: sql<any>`count(*) FILTER (WHERE ${syncTasks.status} = 'processing')`,
        done: sql<any>`count(*) FILTER (WHERE ${syncTasks.status} = 'done')`,
        error: sql<any>`count(*) FILTER (WHERE ${syncTasks.status} = 'error')`,
      })
      .from(syncTasks)
      .where(eq(syncTasks.jobId, jobId));
    const c = rows[0] || ({} as any);
    const coerce = (v: any) => {
      const n = Number(typeof v === 'bigint' ? Number(v) : String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };
    const pending = coerce(c.pending);
    const processing = coerce(c.processing);
    const done = coerce(c.done);
    const error = coerce(c.error);
    const total = pending + processing + done + error;
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
