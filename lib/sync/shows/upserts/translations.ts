/**
 * @fileoverview Операції з перекладами шоу - збереження локалізованих назв та описів
 * @module lib/sync/shows/upserts/translations
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { showTranslations } from '@/db/schema';
import type { NewShowTranslation } from '@/db/schema';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Зберігає переклади шоу по локалі (title/overview/tagline)
 * Оновлює існуючі записи або додає нові
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param payloads - Масив перекладів з локаллю
 */
export async function upsertShowTranslations(
  tx: Tx,
  showId: number,
  payloads: Array<{
    locale: string;
    title: string | null;
    overview: string | null;
    tagline: string | null;
  }>
): Promise<void> {
  const existing = await tx
    .select({ id: showTranslations.id, locale: showTranslations.locale })
    .from(showTranslations)
    .where(eq(showTranslations.showId, showId));

  const byLocale = new Map<string, number>();
  for (const translationRow of existing as any[])
    byLocale.set((translationRow as any).locale, (translationRow as any).id);

  const updateItems: Array<{
    id: number;
    payload: Omit<NewShowTranslation, 'id' | 'showId' | 'locale'> & { updatedAt: Date };
  }> = [];
  const insertItems: NewShowTranslation[] = [];

  for (const translationPayload of payloads) {
    const existingId = byLocale.get(translationPayload.locale);
    const base = {
      title: translationPayload.title || null,
      overview: translationPayload.overview || null,
      tagline: translationPayload.tagline || null,
      updatedAt: new Date(),
    } as any;

    if (existingId) {
      updateItems.push({ id: existingId, payload: base });
    } else {
      insertItems.push({ showId, locale: translationPayload.locale, ...base });
    }
  }

  if (updateItems.length) {
    await Promise.all(
      updateItems.map((updateItem) =>
        tx
          .update(showTranslations)
          .set(updateItem.payload)
          .where(eq(showTranslations.id, updateItem.id))
      )
    );
  }

  if (insertItems.length) await tx.insert(showTranslations).values(insertItems);
}
