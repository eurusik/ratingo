import { NextRequest } from 'next/server';
import { db } from '@/db';
import { featureRequests } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { respondJson, respondError } from '@/lib/http/responses';

/**
 * API: Список запитів фіч з пагінацією та сортуванням.
 * Параметри запиту:
 * - sort: 'votes' | 'recent' — сортування за голосами або за датою (за замовчуванням 'votes').
 * - limit: кількість елементів на сторінку (1..50, за замовчуванням 20).
 * - offset: зсув для пагінації (>=0).
 *
 * Відповідь: { items: FeatureRequest[], hasMore: boolean }
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const sp = url.searchParams;
    const sort = sp.get('sort') === 'recent' ? 'recent' : 'votes';
    const limitParam = Number(sp.get('limit') || 20);
    const offsetParam = Number(sp.get('offset') || 0);
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(50, limitParam)) : 20;
    const offset = Number.isFinite(offsetParam) ? Math.max(0, offsetParam) : 0;

    const rows = await db
      .select()
      .from(featureRequests)
      .orderBy(
        ...(sort === 'recent'
          ? [desc(featureRequests.createdAt)]
          : [desc(featureRequests.votes), desc(featureRequests.createdAt)])
      )
      .limit(limit + 1)
      .offset(offset);
    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    return respondJson({ items, hasMore });
  } catch (e: any) {
    return respondError(e?.message ?? 'Failed to load features', 500);
  }
}
