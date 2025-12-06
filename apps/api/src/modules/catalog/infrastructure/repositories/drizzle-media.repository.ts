import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { IMediaRepository } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { eq, sql } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Drizzle ORM implementation of the Media Repository.
 * Handles complex transactional upserts for media items and relations.
 */
@Injectable()
export class DrizzleMediaRepository implements IMediaRepository {
  private readonly logger = new Logger(DrizzleMediaRepository.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Retrieves minimal media info (ID, slug) by TMDB ID to check existence.
   */
  async findByTmdbId(tmdbId: number): Promise<{ id: number; slug: string } | null> {
    const result = await this.db
      .select({ id: schema.mediaItems.id, slug: schema.mediaItems.slug })
      .from(schema.mediaItems)
      .where(eq(schema.mediaItems.tmdbId, tmdbId))
      .limit(1);
    
    return result[0] || null;
  }

  /**
   * Performs a full transactional upsert of a media item.
   * Updates base table, type-specific details, and syncs genres.
   */
  async upsert(media: NormalizedMedia): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Upsert Base Media Item
      const [mediaItem] = await tx
        .insert(schema.mediaItems)
        .values({
          type: media.type,
          tmdbId: media.externalIds.tmdbId,
          imdbId: media.externalIds.imdbId || null,
          title: media.title,
          originalTitle: media.originalTitle,
          slug: media.slug,
          overview: media.overview,
          posterPath: media.posterPath,
          backdropPath: media.backdropPath,
          rating: media.rating,
          voteCount: media.voteCount,
          popularity: media.popularity,
          releaseDate: media.releaseDate,
          isAdult: media.isAdult,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.mediaItems.tmdbId,
          set: {
            title: media.title,
            originalTitle: media.originalTitle,
            slug: media.slug,
            overview: media.overview,
            rating: media.rating,
            voteCount: media.voteCount,
            popularity: media.popularity,
            posterPath: media.posterPath,
            backdropPath: media.backdropPath,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.mediaItems.id });

      const mediaId = mediaItem.id;

      // Upsert Specific Details (Movie or Show)
      if (media.type === MediaType.MOVIE) {
        await tx
          .insert(schema.movies)
          .values({
            mediaItemId: mediaId,
            runtime: media.details?.runtime,
            budget: media.details?.budget,
            revenue: media.details?.revenue,
            status: media.status,
          })
          .onConflictDoUpdate({
            target: schema.movies.mediaItemId,
            set: {
              runtime: media.details?.runtime,
              budget: media.details?.budget,
              revenue: media.details?.revenue,
              status: media.status,
            },
          });
      } else {
        await tx
          .insert(schema.shows)
          .values({
            mediaItemId: mediaId,
            totalSeasons: media.details?.totalSeasons,
            totalEpisodes: media.details?.totalEpisodes,
            lastAirDate: media.details?.lastAirDate,
            status: media.status,
          })
          .onConflictDoUpdate({
            target: schema.shows.mediaItemId,
            set: {
              totalSeasons: media.details?.totalSeasons,
              totalEpisodes: media.details?.totalEpisodes,
              lastAirDate: media.details?.lastAirDate,
              status: media.status,
            },
          });
      }

      // Sync Genres
      if (media.genres.length > 0) {
        // Ensure genres exist in registry
        await tx
          .insert(schema.genres)
          .values(
            media.genres.map((g) => ({
              tmdbId: g.tmdbId,
              name: g.name,
              slug: g.slug,
            })),
          )
          .onConflictDoNothing();

        // Get internal Genre IDs
        const genreIds = await tx
          .select({ id: schema.genres.id })
          .from(schema.genres)
          .where(
            sql`${schema.genres.tmdbId} IN ${media.genres.map((g) => g.tmdbId)}`,
          );

        if (genreIds.length > 0) {
            // Link genres to media
            await tx
              .insert(schema.mediaGenres)
              .values(
                genreIds.map((g) => ({
                  mediaItemId: mediaId,
                  genreId: g.id,
                })),
              )
              .onConflictDoNothing();
        }
      }
    });
  }
}
