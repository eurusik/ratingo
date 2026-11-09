import { Inject, Injectable, Logger } from '@nestjs/common';

import { and, eq } from 'drizzle-orm';
import { type PostgresJsDatabase } from 'drizzle-orm/postgres-js';

import { DB_CONSTRAINT } from '@/common/constants/database.constants';
import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions';
import { extractPgError, isSlugCollision } from '@/common/utils/pg-error.utils';
import { DATABASE_CONNECTION } from '@/database/database.module';
import * as schema from '@/database/schema';
import {
  type IGenreRepository,
  GENRE_REPOSITORY,
} from '@/modules/catalog/domain/repositories/genre.repository.interface';
import {
  type IMovieRepository,
  MOVIE_REPOSITORY,
} from '@/modules/catalog/domain/repositories/movie.repository.interface';
import {
  type IShowRepository,
  SHOW_REPOSITORY,
} from '@/modules/catalog/domain/repositories/show.repository.interface';
import { createRetrySlug, generateUniqueSlug } from '@/modules/catalog/domain/utils/slug.utils';
import {
  EligibilityStatus,
  EvaluationReason,
  DEFAULT_POLICY_VERSION,
  EvaluationContext,
} from '@/modules/catalog-policy/public';
import type { NormalizedMedia } from '@/modules/shared/contracts';

import { MediaItemPersistenceMapper } from '../mappers/media-item-persistence.mapper';
import { preserveTotalWatchers } from '../utils/stats-preservation.utils';

@Injectable()
export class MediaUpsertQuery {
  private readonly logger = new Logger(MediaUpsertQuery.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(GENRE_REPOSITORY)
    private readonly genreRepository: IGenreRepository,
    @Inject(MOVIE_REPOSITORY)
    private readonly movieRepository: IMovieRepository,
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
  ) {}

  /**
   * Performs a full transactional upsert of a media item.
   * Updates base table, type-specific details, and syncs genres.
   *
   * Proactively resolves slug collisions before INSERT to avoid PG errors.
   * Keeps catch-and-retry as safety net for race conditions.
   *
   * @throws {DatabaseException} If database transaction fails
   */
  async execute(media: NormalizedMedia): Promise<void> {
    let slug: string;
    try {
      slug = await this.resolveSlug(media.type, media.slug, media.externalIds.tmdbId);
    } catch (error) {
      this.handleUpsertError(error, media);
      return; // handleUpsertError always throws, but TS needs explicit return
    }

    try {
      await this.upsertWithSlug(media, slug);
    } catch (error: unknown) {
      // Safety net for race conditions: another process took the slug between check and INSERT
      if (isSlugCollision(error, DB_CONSTRAINT.MEDIA_TYPE_SLUG)) {
        const retrySlug = createRetrySlug(slug, media.externalIds.tmdbId);

        // Guard: if retry produces the same slug, we can't recover
        if (retrySlug === slug) {
          this.handleUpsertError(error, media);
        }

        this.logger.warn(
          `Slug collision race condition for "${slug}", retrying with "${retrySlug}" (tmdbId: ${media.externalIds.tmdbId})`,
        );
        await this.upsertWithSlug(media, retrySlug);
        return;
      }

      // Not a slug collision - handle as regular error
      this.handleUpsertError(error, media);
    }
  }

  /**
   * Proactively checks if slug is taken by a different media item.
   * Returns unique slug (with tmdbId suffix) if collision detected, original slug otherwise.
   */
  private async resolveSlug(
    type: MediaType,
    slug: string | undefined,
    tmdbId: number,
  ): Promise<string> {
    if (!slug) return createRetrySlug(undefined, tmdbId);

    const existing = await this.db
      .select({ tmdbId: schema.mediaItems.tmdbId })
      .from(schema.mediaItems)
      .where(and(eq(schema.mediaItems.type, type), eq(schema.mediaItems.slug, slug)))
      .limit(1);

    // Slug is free, or belongs to the same item (re-sync)
    if (!existing[0] || existing[0].tmdbId === tmdbId) {
      return slug;
    }

    // Slug taken by different item — use unique slug
    const uniqueSlug = generateUniqueSlug(slug, tmdbId);
    this.logger.log(
      `Slug "${slug}" taken by tmdbId ${existing[0].tmdbId}, using "${uniqueSlug}" for tmdbId ${tmdbId}`,
    );
    return uniqueSlug;
  }

  /**
   * Performs the actual upsert transaction with a specific slug.
   */
  private async upsertWithSlug(media: NormalizedMedia, slug: string | undefined): Promise<void> {
    await this.db.transaction(async (tx) => {
      const mediaId = await this.upsertMediaItem(tx, media, slug);
      await this.upsertTypeDetails(tx, mediaId, media);
      await this.genreRepository.syncGenres(tx, mediaId, media.genres);
      await this.upsertMediaStats(tx, mediaId, media);
      await this.upsertDefaultEvaluation(tx, mediaId);
    });
  }

  /**
   * Upserts the base media item record.
   * @returns The media item ID
   */
  private async upsertMediaItem(
    tx: PostgresJsDatabase<typeof schema>,
    media: NormalizedMedia,
    slug: string | undefined,
  ): Promise<string> {
    const insertValues = MediaItemPersistenceMapper.toMediaItemInsert(media);
    // Override slug if provided (for retry with unique slug)
    if (slug) {
      insertValues.slug = slug;
    }

    const updateValues = MediaItemPersistenceMapper.toMediaItemUpdate(media);
    // Also update slug on conflict if we're using a unique slug
    if (slug && slug !== media.slug) {
      updateValues.slug = slug;
    }

    const [mediaItem] = await tx
      .insert(schema.mediaItems)
      .values(insertValues)
      .onConflictDoUpdate({
        target: [schema.mediaItems.type, schema.mediaItems.tmdbId], // Composite key: type + tmdb_id
        set: updateValues,
      })
      .returning({ id: schema.mediaItems.id });

    return mediaItem.id;
  }

  /**
   * Upserts type-specific details (movie or show).
   */
  private async upsertTypeDetails(
    tx: PostgresJsDatabase<typeof schema>,
    mediaId: string,
    media: NormalizedMedia,
  ): Promise<void> {
    if (media.type === MediaType.MOVIE) {
      await this.movieRepository.upsertDetails(tx, mediaId, media.details ?? {});
    } else {
      await this.showRepository.upsertDetails(tx, mediaId, media.details ?? {});
    }
  }

  /**
   * Upserts media stats (Ratingo scores, watchers data).
   */
  private async upsertMediaStats(
    tx: PostgresJsDatabase<typeof schema>,
    mediaId: string,
    media: NormalizedMedia,
  ): Promise<void> {
    const statsInsert = MediaItemPersistenceMapper.toMediaStatsInsert(mediaId, media);
    if (!statsInsert) return;

    // Build update set - only include fields with actual data
    // This prevents overwriting valid data with null/0 on API failures
    const updateSet: Record<string, unknown> = {
      ratingoScore: statsInsert.ratingoScore,
      qualityScore: statsInsert.qualityScore,
      popularityScore: statsInsert.popularityScore,
      freshnessScore: statsInsert.freshnessScore,
      updatedAt: new Date(),
    };

    // CRITICAL: Only update watchersCount if we have actual data
    // If watchersCount is missing in statsInsert, preserve existing DB value
    if (statsInsert.watchersCount != null) {
      updateSet.watchersCount = statsInsert.watchersCount;
    }

    // CRITICAL: Only update totalWatchers if we have actual data
    // If totalWatchers is missing in statsInsert, preserve existing DB value
    if (statsInsert.totalWatchers != null) {
      // Safeguard: don't overwrite positive value with 0 (likely API error)
      updateSet.totalWatchers = preserveTotalWatchers(statsInsert.totalWatchers);
    }

    await tx.insert(schema.mediaStats).values(statsInsert).onConflictDoUpdate({
      target: schema.mediaStats.mediaItemId,
      set: updateSet,
    });
  }

  /**
   * Upserts default catalog evaluation (INELIGIBLE until evaluated by Policy Engine).
   */
  private async upsertDefaultEvaluation(
    tx: PostgresJsDatabase<typeof schema>,
    mediaId: string,
  ): Promise<void> {
    // Design Decision DD-3: Every media_item MUST have a corresponding evaluation record
    // This ensures the 1:1 invariant and prevents items from being "stuck" without evaluation
    //
    // Per Readability & Pending Reform: PENDING is no longer used.
    // New items start as INELIGIBLE with NO_ACTIVE_POLICY reason until evaluated.
    await tx
      .insert(schema.mediaCatalogEvaluations)
      .values({
        mediaItemId: mediaId,
        status: EligibilityStatus.INELIGIBLE,
        policyVersion: DEFAULT_POLICY_VERSION,
        reasons: [EvaluationReason.NO_ACTIVE_POLICY],
        relevanceScore: 0,
        evaluatedAt: null, // NULL for items not yet evaluated by Policy Engine
        context: EvaluationContext.CATALOG, // Default context for catalog evaluation
      })
      .onConflictDoNothing(); // If already exists, don't overwrite (evaluation job will update it)
  }

  /**
   * Handles upsert errors by logging and throwing DatabaseException.
   */
  private handleUpsertError(error: unknown, media: NormalizedMedia): never {
    const pgError = extractPgError(error);

    this.logger.error(`Failed to upsert media ${media.title}`, {
      message: pgError.message,
      code: pgError.code,
      detail: pgError.detail,
      constraint: pgError.constraint,
      tmdbId: media.externalIds.tmdbId,
    });

    throw new DatabaseException(`Failed to upsert media: ${pgError.message}`, error, {
      tmdbId: media.externalIds.tmdbId,
      title: media.title,
      code: pgError.code,
      detail: pgError.detail,
      constraint: pgError.constraint,
    });
  }
}
