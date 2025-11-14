import { db } from '@/db';
import { watchProvidersRegistry, showWatchProviders } from '@/db/schema';
import { sql, eq, inArray } from 'drizzle-orm';

// One-time helper to backfill registry from existing join table
export async function backfillProviderRegistryFromJoinTable() {
  const distinctIdsRows = await db
    .select({ providerId: showWatchProviders.providerId })
    .from(showWatchProviders)
    .where(sql`"show_watch_providers"."provider_id" IS NOT NULL`)
    .groupBy(showWatchProviders.providerId);

  const ids = distinctIdsRows.map((r: any) => Number(r.providerId)).filter(Boolean);
  if (ids.length === 0) return { inserted: 0, updated: 0 };

  const existing = await db
    .select({ id: watchProvidersRegistry.id, tmdbId: watchProvidersRegistry.tmdbId })
    .from(watchProvidersRegistry)
    .where(inArray(watchProvidersRegistry.tmdbId, ids));
  const byId = new Map<number, number>();
  for (const r of existing as any[]) byId.set(Number((r as any).tmdbId), Number((r as any).id));

  let inserted = 0; let updated = 0;
  // Fetch representative name/logo from first matching row per providerId
  for (const pid of ids) {
    const row = await db
      .select({ name: showWatchProviders.providerName, logoPath: showWatchProviders.logoPath })
      .from(showWatchProviders)
      .where(eq(showWatchProviders.providerId, pid))
      .limit(1);
    const p = (row as any[])[0] || {};
    const name = p?.name || null;
    const logo = p?.logoPath || null;
    const slug = (String(name || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')) || null;

    const existingId = byId.get(pid);
    if (existingId) {
      await db.update(watchProvidersRegistry).set({ name, logoPath: logo, slug, updatedAt: new Date() }).where(eq(watchProvidersRegistry.id, existingId));
      updated++;
    } else {
      await db.insert(watchProvidersRegistry).values({ tmdbId: pid, name, logoPath: logo, slug, createdAt: new Date(), updatedAt: new Date() });
      inserted++;
    }
  }
  return { inserted, updated };
}