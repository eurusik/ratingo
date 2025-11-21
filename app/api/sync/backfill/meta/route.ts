import { NextResponse } from 'next/server';
import { runMetaBackfill, backfillShowMetaById } from '@/lib/sync/shows/backfill';

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
