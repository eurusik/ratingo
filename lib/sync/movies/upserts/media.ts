import { db } from '@/db';
import { eq, inArray } from 'drizzle-orm';
import {
  movieVideos,
  movieWatchProviders,
  watchProvidersRegistry,
  movieContentRatings,
} from '@/db/schema';
import type {
  NewMovieVideo,
  NewMovieWatchProvider,
  NewWatchProviderRegistry,
  NewMovieContentRating,
} from '@/db/schema';
import type { TMDBVideo, WatchProvider } from '@/lib/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Нормалізує назву провайдера у slug: латиниця, lower, дефіси */
function toSlug(name: string | null | undefined): string | null {
  const normalized = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || null;
}

/** Зберігає офіційні відео (трейлери/тизери) для фільму */
export async function upsertMovieVideos(
  tx: Tx,
  movieId: number,
  videos: TMDBVideo[]
): Promise<void> {
  if (!videos.length) return;

  const existingVideoRows = await tx
    .select({ id: movieVideos.id, site: movieVideos.site, key: movieVideos.key })
    .from(movieVideos)
    .where(eq(movieVideos.movieId, movieId));

  const videoIdBySiteKeyMap = new Map<string, number>();
  for (const existingVideoRow of existingVideoRows)
    videoIdBySiteKeyMap.set(
      `${String(existingVideoRow.site)}|${String(existingVideoRow.key)}`,
      existingVideoRow.id as number
    );

  const videoUpdates: Array<{ id: number; payload: NewMovieVideo }> = [];
  const videoInserts: NewMovieVideo[] = [];

  for (const video of videos) {
    const payload: NewMovieVideo = {
      movieId,
      site: String(video.site || ''),
      key: String(video.key || ''),
      name: video.name || null,
      type: video.type || null,
      locale: video.iso_639_1 || null,
      official: typeof video.official === 'boolean' ? video.official : null,
      publishedAt: video.published_at ? new Date(video.published_at) : null,
      updatedAt: new Date(),
    };

    const compositeKey = `${payload.site}|${payload.key}`;
    const existingVideoId = videoIdBySiteKeyMap.get(compositeKey);
    if (existingVideoId) videoUpdates.push({ id: existingVideoId, payload });
    else videoInserts.push(payload);
  }

  if (videoUpdates.length)
    await Promise.all(
      videoUpdates.map((videoUpdate) =>
        tx.update(movieVideos).set(videoUpdate.payload).where(eq(movieVideos.id, videoUpdate.id))
      )
    );

  if (videoInserts.length) await tx.insert(movieVideos).values(videoInserts);
}

/** Оновлює реєстр провайдерів перегляду (TMDB provider_id → slug/name) */
export async function upsertProvidersRegistry(tx: Tx, providers: WatchProvider[]): Promise<void> {
  const providerIds = Array.from(
    new Set((providers || []).map((p) => Number(p.id || 0)).filter(Boolean))
  );
  if (!providerIds.length) return;

  const existingRegistryRows = await tx
    .select({ tmdbId: watchProvidersRegistry.tmdbId, id: watchProvidersRegistry.id })
    .from(watchProvidersRegistry)
    .where(inArray(watchProvidersRegistry.tmdbId, providerIds));

  const registryIdByTmdbIdMap = new Map<number, number>();
  for (const registryRow of existingRegistryRows)
    registryIdByTmdbIdMap.set(registryRow.tmdbId as number, registryRow.id as number);

  const registryInserts: NewWatchProviderRegistry[] = [];
  const registryUpdates: Array<{ id: number; payload: NewWatchProviderRegistry }> = [];

  for (const provider of providers) {
    const pid = Number(provider.id || 0);
    if (!pid) continue;

    const payload: NewWatchProviderRegistry = {
      tmdbId: pid,
      name: provider.name,
      logoPath: provider.logo_path || null,
      slug: toSlug(provider.name),
      updatedAt: new Date(),
    };

    const existingRegistryId = registryIdByTmdbIdMap.get(pid);
    if (existingRegistryId) registryUpdates.push({ id: existingRegistryId, payload });
    else registryInserts.push({ ...payload, createdAt: new Date() });
  }

  if (registryInserts.length) await tx.insert(watchProvidersRegistry).values(registryInserts);

  for (const registryUpdate of registryUpdates)
    await tx
      .update(watchProvidersRegistry)
      .set(registryUpdate.payload)
      .where(eq(watchProvidersRegistry.id, registryUpdate.id));
}

/** Зберігає провайдерів перегляду фільму (нормалізовано по регіону/категорії) */
export async function upsertMovieWatchProviders(
  tx: Tx,
  movieId: number,
  providers: WatchProvider[]
): Promise<void> {
  if (!providers.length) return;

  const existingProviderRows = await tx
    .select({
      id: movieWatchProviders.id,
      region: movieWatchProviders.region,
      providerId: movieWatchProviders.providerId,
      category: movieWatchProviders.category,
    })
    .from(movieWatchProviders)
    .where(eq(movieWatchProviders.movieId, movieId));

  const providerIdByRegionCategoryMap = new Map<string, number>();
  for (const providerRow of existingProviderRows)
    providerIdByRegionCategoryMap.set(
      `${String(providerRow.region)}|${String(providerRow.providerId)}|${String(providerRow.category)}`,
      providerRow.id as number
    );

  const providerUpdates: Array<{ id: number; payload: NewMovieWatchProvider }> = [];
  const providerInserts: NewMovieWatchProvider[] = [];

  for (const provider of providers) {
    const payload: NewMovieWatchProvider = {
      movieId,
      region: String(provider.region || ''),
      providerId: Number(provider.id || 0),
      providerName: provider.name || null,
      logoPath: provider.logo_path || null,
      linkUrl: provider.link || null,
      category: provider.category || null,
      rank: typeof provider.rank === 'number' ? provider.rank : null,
      updatedAt: new Date(),
    };

    const compositeKey = `${payload.region}|${payload.providerId}|${payload.category}`;
    const existingProviderId = providerIdByRegionCategoryMap.get(compositeKey);
    if (existingProviderId) providerUpdates.push({ id: existingProviderId, payload });
    else providerInserts.push(payload);
  }

  if (providerUpdates.length)
    await Promise.all(
      providerUpdates.map((providerUpdate) =>
        tx
          .update(movieWatchProviders)
          .set(providerUpdate.payload)
          .where(eq(movieWatchProviders.id, providerUpdate.id))
      )
    );

  if (providerInserts.length) await tx.insert(movieWatchProviders).values(providerInserts);
}

/** Зберігає вікові рейтинги фільму для регіонів UA та US */
export async function upsertContentRatings(
  tx: Tx,
  movieId: number,
  ratingsByRegion: { UA: string | null; US: string | null }
): Promise<void> {
  type Region = 'UA' | 'US';
  const targetRegions: Region[] = ['UA', 'US'];

  const existingContentRows = await tx
    .select({ id: movieContentRatings.id, region: movieContentRatings.region })
    .from(movieContentRatings)
    .where(eq(movieContentRatings.movieId, movieId));

  const contentByRegionMap = new Map<Region, number>();
  for (const contentRatingRow of existingContentRows) {
    const regionKey = contentRatingRow.region as Region;
    contentByRegionMap.set(regionKey, contentRatingRow.id as number);
  }

  const contentRatingUpdates: Array<{ id: number; payload: NewMovieContentRating }> = [];
  const contentRatingInserts: NewMovieContentRating[] = [];

  for (const region of targetRegions) {
    const rating = ratingsByRegion[region];
    if (!rating) continue;

    const payload: NewMovieContentRating = {
      movieId,
      region,
      rating,
      updatedAt: new Date(),
    };

    const existingId = contentByRegionMap.get(region);
    if (existingId) {
      contentRatingUpdates.push({ id: existingId, payload });
    } else {
      contentRatingInserts.push(payload);
    }
  }

  if (contentRatingUpdates.length) {
    await Promise.all(
      contentRatingUpdates.map((update) =>
        tx
          .update(movieContentRatings)
          .set(update.payload)
          .where(eq(movieContentRatings.id, update.id))
      )
    );
  }

  if (contentRatingInserts.length) {
    await tx.insert(movieContentRatings).values(contentRatingInserts);
  }
}
