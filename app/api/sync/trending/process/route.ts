import { NextResponse } from 'next/server';
import { runTrendingProcessor } from '@/lib/sync/trendingProcessor';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const limit = Math.max(1, Math.min(50, parseInt(String(limitParam || '10'), 10) || 10));
    const res = await runTrendingProcessor({ limit });
    return NextResponse.json(res);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
