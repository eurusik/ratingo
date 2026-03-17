import { Inject, Injectable, Logger } from '@nestjs/common';

import { SavedItemsService } from '../../user-actions/application/saved-items.service';
import { ACTION_CONTEXT } from '../../user-actions/domain/entities/user-media-action.entity';
import { SAVED_ITEM_LIST } from '../../user-actions/domain/entities/user-saved-item.entity';
import { MEDIA_LOOKUP_PORT } from '../domain/constants/import.constants';
import {
  type ExternalMediaEntry,
  type ImportCommand,
  type ImportOutcome,
} from '../domain/entities/external-media-entry';
import { USER_MEDIA_STATE } from '../domain/entities/user-media-state.entity';
import { type IMediaLookupPort } from '../domain/ports/media-lookup.port';
import {
  type IUserMediaStateRepository,
  USER_MEDIA_STATE_REPOSITORY,
} from '../domain/repositories/user-media-state.repository.interface';

import { ImportPendingService } from './import-pending.service';

/**
 * Application service for bulk-importing external media ratings and watchlists.
 *
 * Matching strategy:
 *  1. Batch lookup by IMDB ID (globally unique, unambiguous).
 *     Duplicate IMDB IDs in the input are deduplicated (last entry wins).
 *  2. For still-unmatched entries: batch lookup by TMDB ID (unique per type).
 *     - 1 match  → use it.
 *     - 2 matches → take first and log a warning (movie vs show ambiguity).
 *  3. Remaining unmatched entries are reported as notFound.
 *     Not-found items with an IMDB or TMDB ID are submitted for background
 *     auto-ingestion via ImportPendingService.
 *
 * No events are emitted — this is a bulk operation, not an interactive single-item flow.
 */
@Injectable()
export class ImportMediaService {
  private readonly logger = new Logger(ImportMediaService.name);

  constructor(
    @Inject(MEDIA_LOOKUP_PORT)
    private readonly mediaLookup: IMediaLookupPort,
    @Inject(USER_MEDIA_STATE_REPOSITORY)
    private readonly repo: IUserMediaStateRepository,
    private readonly importPendingService: ImportPendingService,
    private readonly savedItemsService: SavedItemsService,
  ) {}

  async import(command: ImportCommand): Promise<ImportOutcome> {
    const start = Date.now();
    this.logger.log(
      `Starting import: userId=${command.userId} source=${command.source} items=${command.items.length} overwrite=${command.overwriteExisting}`,
    );

    const { matched, notFound } = await this.resolveMediaIds(command.items);

    const toImport = Array.from(matched.entries()).map(([entry, mediaItemId]) => ({
      entry,
      mediaItemId,
    }));

    const dbItems = toImport.map(({ entry, mediaItemId }) => ({
      mediaItemId,
      state: entry.state,
      rating: entry.rating ?? null,
    }));

    let dbImported = 0;
    let dbSkipped = 0;

    if (dbItems.length > 0) {
      const result = await this.repo.bulkImport(command.userId, dbItems, command.overwriteExisting);
      dbImported = result.imported;
      dbSkipped = result.skipped;
    }

    // Save planned (watchlist) items to for_later — non-critical, per-item isolation
    const plannedItems = toImport.filter(({ entry }) => entry.state === USER_MEDIA_STATE.PLANNED);
    const SAVE_CONCURRENCY = 50;
    for (let i = 0; i < plannedItems.length; i += SAVE_CONCURRENCY) {
      const chunk = plannedItems.slice(i, i + SAVE_CONCURRENCY);
      await Promise.allSettled(
        chunk.map(({ mediaItemId }) =>
          this.savedItemsService
            .saveItem({
              userId: command.userId,
              mediaItemId,
              list: SAVED_ITEM_LIST.FOR_LATER,
              context: ACTION_CONTEXT.IMPORT,
            })
            .catch((error: unknown) => {
              this.logger.warn(
                `Non-critical: failed to save planned item to for_later: userId=${command.userId} mediaItemId=${mediaItemId}: ${(error as Error).message}`,
              );
            }),
        ),
      );
    }

    // Queue background auto-ingestion for not-found items that have an identifier
    let pendingBatch: ImportOutcome['pendingBatch'];
    const pendingItems = notFound.filter((e) => e.imdbId || e.tmdbId);
    if (pendingItems.length > 0) {
      try {
        const batches = await this.importPendingService.createPendingBatches(
          command.userId,
          command.source,
          pendingItems,
        );
        const totalItems = batches.reduce((sum, b) => sum + b.totalItems, 0);
        if (batches.length > 0) {
          pendingBatch = { batchId: batches[0].id, totalItems };
        }
      } catch (error) {
        // Non-critical: log but don't fail the import
        this.logger.error(
          `Failed to create pending batch for userId=${command.userId}: ${(error as Error).message}`,
          (error as Error).stack,
        );
      }
    }

    const durationMs = Date.now() - start;
    this.logger.log(
      `Import complete: imported=${dbImported} skipped=${dbSkipped} notFound=${notFound.length} pending=${pendingItems.length} durationMs=${durationMs}`,
    );

    return {
      imported: dbImported,
      skipped: dbSkipped,
      notFound: notFound.length,
      durationMs,
      details: {
        imported: toImport.map(({ entry, mediaItemId }) => ({
          title: entry.title,
          mediaItemId,
          state: entry.state,
          rating: entry.rating ?? null,
        })),
        skipped: [],
        notFound: notFound.map((entry) => ({
          title: entry.title,
          imdbId: entry.imdbId,
          tmdbId: entry.tmdbId,
        })),
      },
      ...(pendingBatch && { pendingBatch }),
    };
  }

  private async resolveMediaIds(items: ExternalMediaEntry[]): Promise<{
    matched: Map<ExternalMediaEntry, string>;
    notFound: ExternalMediaEntry[];
  }> {
    const matched = new Map<ExternalMediaEntry, string>();

    // Deduplicate by IMDB ID — last CSV row with this IMDB ID wins
    const deduplicatedByImdb = new Map<string, ExternalMediaEntry>();
    for (const item of items) {
      if (item.imdbId) deduplicatedByImdb.set(item.imdbId, item);
    }

    const needsTmdbPass: ExternalMediaEntry[] = [];

    const imdbIds = [...deduplicatedByImdb.keys()];
    if (imdbIds.length === 0) {
      // No IMDB IDs at all → everything goes to TMDB pass
      needsTmdbPass.push(...items);
    } else {
      const imdbResults = await this.mediaLookup.findManyByImdbIds(imdbIds);
      const imdbToMediaId = new Map(imdbResults.map((r) => [r.imdbId, r.id]));

      // Filter items so only the last occurrence of each IMDB ID proceeds.
      // Items without an imdbId pass through unchanged.
      const deduplicatedItems = items.filter(
        (item) => !item.imdbId || deduplicatedByImdb.get(item.imdbId) === item,
      );
      this.classifyByImdb(deduplicatedItems, imdbToMediaId, matched, needsTmdbPass);
    }

    const hasTmdb = needsTmdbPass.filter((item) => item.tmdbId != null);
    const hasNothing = needsTmdbPass.filter((item) => item.tmdbId == null);

    if (hasTmdb.length === 0) {
      return { matched, notFound: hasNothing };
    }

    const tmdbIds = [...new Set(hasTmdb.map((item) => item.tmdbId!))];
    const tmdbResults = await this.mediaLookup.findManyByTmdbIds(tmdbIds);

    // Group by tmdbId — TMDB IDs are unique per type, so at most 2 results per ID
    const tmdbToMediaItems = new Map<number, Array<{ id: string; type: string }>>();
    for (const r of tmdbResults) {
      const bucket = tmdbToMediaItems.get(r.tmdbId) ?? [];
      bucket.push({ id: r.id, type: r.type });
      tmdbToMediaItems.set(r.tmdbId, bucket);
    }

    const notFoundAfterTmdb: ExternalMediaEntry[] = [];
    for (const item of hasTmdb) {
      const candidates = tmdbToMediaItems.get(item.tmdbId!) ?? [];
      this.resolveTmdbCandidates(item, candidates, matched, notFoundAfterTmdb);
    }

    return {
      matched,
      notFound: [...hasNothing, ...notFoundAfterTmdb],
    };
  }

  private classifyByImdb(
    items: ExternalMediaEntry[],
    imdbToMediaId: Map<string, string>,
    matched: Map<ExternalMediaEntry, string>,
    needsTmdbPass: ExternalMediaEntry[],
  ): void {
    for (const item of items) {
      if (!item.imdbId) {
        needsTmdbPass.push(item);
        continue;
      }
      const mediaItemId = imdbToMediaId.get(item.imdbId);
      if (mediaItemId) {
        matched.set(item, mediaItemId);
      } else {
        needsTmdbPass.push(item);
      }
    }
  }

  private resolveTmdbCandidates(
    item: ExternalMediaEntry,
    candidates: Array<{ id: string; type: string }>,
    matched: Map<ExternalMediaEntry, string>,
    notFound: ExternalMediaEntry[],
  ): void {
    if (candidates.length === 0) {
      notFound.push(item);
      return;
    }

    if (candidates.length === 1) {
      matched.set(item, candidates[0].id);
      return;
    }

    // Two candidates (movie + show with same TMDB ID).
    // Take the first match and warn — the caller would need entry.type to resolve cleanly.
    this.logger.warn(
      `Ambiguous TMDB ID ${item.tmdbId} matched ${candidates.length} catalog items ` +
        `(${candidates.map((c) => c.type).join(', ')}) — using first match. ` +
        `Title: ${item.title ?? 'unknown'}`,
    );
    matched.set(item, candidates[0].id);
  }
}
