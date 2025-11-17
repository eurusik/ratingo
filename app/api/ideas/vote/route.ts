import { NextRequest } from 'next/server';
import { db } from '@/db';
import { featureRequests } from '@/db/schema';
import { respondJson, respondError } from '@/lib/http/responses';
import { eq, sql } from 'drizzle-orm';
import { getCachedJson, setCachedJson } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);
    if (!Number.isFinite(id) || id <= 0) {
      return respondError('Недійсний ID фічі', 400);
    }

    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : 'unknown';
    const rlKey = `rl:vote:${ip}:${id}`;
    const already = await getCachedJson<{ v: 1 }>(rlKey);
    if (already) {
      return respondError('Ви вже голосували за цю фічу', 429);
    }

    const [updated] = await db
      .update(featureRequests)
      .set({ votes: sql`${featureRequests.votes} + 1` })
      .where(eq(featureRequests.id, id))
      .returning();

    if (!updated) {
      return respondError('Фіча не знайдена', 404);
    }
    await setCachedJson(rlKey, { v: 1 }, 60 * 60 * 24);
    return respondJson({ item: updated });
  } catch (e: any) {
    return respondError(e?.message ?? 'Не вдалося проголосувати', 500);
  }
}
