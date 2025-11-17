import { NextRequest } from 'next/server';
import { db } from '@/db';
import { featureRequests } from '@/db/schema';
import { respondJson, respondError } from '@/lib/http/responses';
import { getCachedJson, setCachedJson } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const brief = typeof body?.brief === 'string' ? body.brief.trim() : '';
    const description = typeof body?.description === 'string' ? body.description.trim() : '';
    const tags = Array.isArray(body?.tags) ? body.tags.slice(0, 10) : [];

    if (!title || title.length < 3 || title.length > 128) {
      return respondError('Недійсна назва фічі', 400);
    }
    if (brief && brief.length > 256) {
      return respondError('Занадто довгий короткий опис', 400);
    }
    if (description && description.length > 2000) {
      return respondError('Занадто довгий опис', 400);
    }
    const cleanTags = tags
      .map((t: any) => (typeof t === 'string' ? t.trim() : ''))
      .filter(Boolean)
      .slice(0, 5)
      .map((t: string) => (t.length > 24 ? t.slice(0, 24) : t));

    const ipHeader = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip');
    const ip = typeof ipHeader === 'string' ? ipHeader.split(',')[0].trim() : 'unknown';
    const rlKey = `rl:req:${ip}`;
    const current = (await getCachedJson<{ c: number }>(rlKey)) || { c: 0 };
    if (current.c >= 3) {
      return respondError('Забагато запитів. Спробуйте пізніше', 429);
    }
    await setCachedJson(rlKey, { c: current.c + 1 }, 300);

    const [created] = await db
      .insert(featureRequests)
      .values({ title, brief, description, tags: cleanTags, status: 'submitted' })
      .returning();

    return respondJson({ item: created }, { status: 201 });
  } catch (e: any) {
    return respondError(e?.message ?? 'Не вдалося створити фічу', 500);
  }
}
