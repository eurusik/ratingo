/**
 * @fileoverview Операції з медіа шоу - відео, провайдери перегляду, контент рейтинги
 * @module lib/sync/shows/upserts/media
 */

import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { showVideos, showWatchProviders, showContentRatings } from '@/db/schema';
import type { NewShowVideo, NewShowWatchProvider, NewShowContentRating } from '@/db/schema';
import type { TMDBVideo, WatchProvider } from '@/lib/types';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Оновлює/створює відео шоу (трейлери, тизери тощо)
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param videos - Масив відео з TMDB
 */
export async function upsertShowVideos(tx: Tx, showId: number, videos: TMDBVideo[]): Promise<void> {
  if (!videos.length) return;

  const existingVideoRows = await tx
    .select({ id: showVideos.id, site: showVideos.site, key: showVideos.key })
    .from(showVideos)
    .where(eq(showVideos.showId, showId));

  const videoIdBySiteKeyMap = new Map<string, number>();
  for (const existingVideoRow of existingVideoRows)
    videoIdBySiteKeyMap.set(
      `${String(existingVideoRow.site)}|${String(existingVideoRow.key)}`,
      existingVideoRow.id as number
    );

  const videoUpdates: Array<{ id: number; payload: NewShowVideo }> = [];
  const videoInserts: NewShowVideo[] = [];

  for (const video of videos) {
    const payload: NewShowVideo = {
      showId,
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

    if (existingVideoId) {
      videoUpdates.push({ id: existingVideoId, payload });
    } else {
      videoInserts.push(payload);
    }
  }

  if (videoUpdates.length) {
    await Promise.all(
      videoUpdates.map((videoUpdate) =>
        tx.update(showVideos).set(videoUpdate.payload).where(eq(showVideos.id, videoUpdate.id))
      )
    );
  }

  if (videoInserts.length) await tx.insert(showVideos).values(videoInserts);
}

/**
 * Оновлює/створює провайдери перегляду шоу
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param providers - Масив провайдерів перегляду
 */
export async function upsertShowWatchProviders(
  tx: Tx,
  showId: number,
  providers: WatchProvider[]
): Promise<void> {
  if (!providers.length) return;

  const existingProviderRows = await tx
    .select({
      id: showWatchProviders.id,
      region: showWatchProviders.region,
      providerId: showWatchProviders.providerId,
      category: showWatchProviders.category,
    })
    .from(showWatchProviders)
    .where(eq(showWatchProviders.showId, showId));

  const providerIdByRegionCategoryMap = new Map<string, number>();
  for (const providerRow of existingProviderRows)
    providerIdByRegionCategoryMap.set(
      `${String(providerRow.region)}|${String(providerRow.providerId)}|${String(providerRow.category)}`,
      providerRow.id as number
    );

  const providerUpdates: Array<{ id: number; payload: NewShowWatchProvider }> = [];
  const providerInserts: NewShowWatchProvider[] = [];

  for (const provider of providers) {
    const payload: NewShowWatchProvider = {
      showId,
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

    if (existingProviderId) {
      providerUpdates.push({ id: existingProviderId, payload });
    } else {
      providerInserts.push(payload);
    }
  }

  if (providerUpdates.length) {
    await Promise.all(
      providerUpdates.map((providerUpdate) =>
        tx
          .update(showWatchProviders)
          .set(providerUpdate.payload)
          .where(eq(showWatchProviders.id, providerUpdate.id))
      )
    );
  }

  if (providerInserts.length) await tx.insert(showWatchProviders).values(providerInserts);
}

/**
 * Оновлює/створює вікові рейтинги контенту для шоу (UA, US)
 * @param tx - Транзакція бази даних
 * @param showId - Внутрішній ID шоу
 * @param ratingsByRegion - Об'єкт з рейтингами за регіонами
 */
export async function upsertShowContentRatings(
  tx: Tx,
  showId: number,
  ratingsByRegion: { UA: string | null; US: string | null }
): Promise<void> {
  type Region = 'UA' | 'US';
  const targetRegions: Region[] = ['UA', 'US'];

  const existingContentRows = await tx
    .select({ id: showContentRatings.id, region: showContentRatings.region })
    .from(showContentRatings)
    .where(eq(showContentRatings.showId, showId));

  const contentByRegionMap = new Map<Region, number>();
  for (const contentRatingRow of existingContentRows) {
    const regionKey = contentRatingRow.region as Region;
    contentByRegionMap.set(regionKey, contentRatingRow.id as number);
  }

  const contentRatingUpdates: Array<{ id: number; payload: NewShowContentRating }> = [];
  const contentRatingInserts: NewShowContentRating[] = [];

  for (const region of targetRegions) {
    const value = ratingsByRegion[region];
    if (!value) continue;

    const payload: NewShowContentRating = {
      showId,
      region,
      rating: String(value),
      updatedAt: new Date(),
    };

    const existingRegionId = contentByRegionMap.get(region);
    if (existingRegionId) {
      contentRatingUpdates.push({ id: existingRegionId, payload });
    } else {
      contentRatingInserts.push(payload);
    }
  }

  if (contentRatingUpdates.length) {
    await Promise.all(
      contentRatingUpdates.map((contentRatingUpdate) =>
        tx
          .update(showContentRatings)
          .set(contentRatingUpdate.payload)
          .where(eq(showContentRatings.id, contentRatingUpdate.id))
      )
    );
  }

  if (contentRatingInserts.length) await tx.insert(showContentRatings).values(contentRatingInserts);
}
