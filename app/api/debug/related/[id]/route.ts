import { NextResponse } from 'next/server';
import { db } from '@/db';
import { shows, showRelated } from '@/db/schema';
import { eq } from 'drizzle-orm';

/**
 * GET /api/debug/related/[id]
 * Повертає повʼязані серіали для заданого внутрішнього `showId`.
 *
 * Вхід:
 * - `params.id`: рядковий ID у маршруті
 *
 * Вихід:
 * - `{ success: boolean, count: number, related: Array<{ id, tmdbId, title }> }`
 *
 * @example
 * curl -s http://localhost:3000/api/debug/related/107 | jq .
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const showId = await parseShowIdParam(params);
    const relatedRows = await fetchRelatedRows(showId);
    const relatedItems = mapRelatedRows(relatedRows);
    return NextResponse.json({ success: true, count: relatedItems.length, related: relatedItems });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const isBadRequest = message.toLowerCase().includes('invalid');
    return NextResponse.json(
      { success: false, error: message },
      { status: isBadRequest ? 400 : 500 }
    );
  }
}

/**
 * Парсить і валідовує параметр `id` з контексту маршруту.
 *
 * @param routeParams Обʼєкт параметрів маршруту (`{ id: string }`) загорнутий у Promise
 * @returns Валідний числовий `showId`
 * @throws Error, якщо `id` некоректний
 */
async function parseShowIdParam(routeParams: Promise<{ id: string }>): Promise<number> {
  const { id } = await routeParams;
  const showId = Number(id);
  if (!Number.isFinite(showId) || showId <= 0) {
    throw new Error('Invalid id');
  }
  return showId;
}

/**
 * Витягує повʼязані записи через мапінг `show_related` → `shows`.
 *
 * @param showId Внутрішній ID базового шоу
 * @returns Сирі рядки обʼєднання `show_related` + `shows`
 */
async function fetchRelatedRows(showId: number): Promise<any[]> {
  const rows = await db
    .select()
    .from(showRelated)
    .innerJoin(shows, eq(showRelated.relatedShowId, shows.id))
    .where(eq(showRelated.showId, showId));
  return rows as any[];
}

/**
 * Мапить обʼєднані рядки у просту структуру для відповіді API.
 *
 * @param joinedRows Рядки `show_related` + `shows`
 * @returns Масив `{ id, tmdbId, title }`
 */
function mapRelatedRows(joinedRows: any[]): Array<{ id: number; tmdbId: number; title: string }> {
  return joinedRows.map((joined) => {
    const showRow = joined.shows || joined['shows'];
    return {
      id: Number(showRow.id),
      tmdbId: Number(showRow.tmdbId),
      title: showRow.titleUk || showRow.title,
    };
  });
}
