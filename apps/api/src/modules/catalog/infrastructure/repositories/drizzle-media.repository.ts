import { Inject, Injectable, Logger } from '@nestjs/common';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { IMediaRepository } from '@/modules/catalog/domain/repositories/media.repository.interface';
import { NormalizedMedia } from '@/modules/ingestion/domain/models/normalized-media.model';
import { eq, sql, inArray } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';
import { DatabaseException } from '@/common/exceptions';

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
   *
   * @throws {DatabaseException} If database query fails
   */
  async findByTmdbId(tmdbId: number): Promise<{ id: string; slug: string } | null> {
    try {
      const result = await this.db
        .select({ id: schema.mediaItems.id, slug: schema.mediaItems.slug })
        .from(schema.mediaItems)
        .where(eq(schema.mediaItems.tmdbId, tmdbId))
        .limit(1);
      
      return result[0] || null;
    } catch (error) {
      this.logger.error(`Failed to find media by TMDB ID ${tmdbId}: ${error.message}`);
      throw new DatabaseException(`Failed to find media: ${error.message}`, { tmdbId });
    }
  }

  /**
   * Performs a full transactional upsert of a media item.
   * Updates base table, type-specific details, and syncs genres.
   *
   * @throws {DatabaseException} If database transaction fails
   */
  async upsert(media: NormalizedMedia): Promise<void> {
    try {
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
          
          // Metrics
          rating: media.rating,
          voteCount: media.voteCount,
          popularity: media.popularity,
          trendingScore: media.trendingScore ?? 0,
          
          // External Ratings
          ratingImdb: media.ratingImdb,
          voteCountImdb: media.voteCountImdb,
          ratingTrakt: media.ratingTrakt,
          voteCountTrakt: media.voteCountTrakt,
          ratingMetacritic: media.ratingMetacritic,
          ratingRottenTomatoes: media.ratingRottenTomatoes,

          releaseDate: media.releaseDate,
          isAdult: media.isAdult,
          updatedAt: new Date(),
        } as any) // Explicit cast to bypass strict type check for now
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
            // Only update trendingScore if provided
            ...(media.trendingScore !== undefined ? { trendingScore: media.trendingScore } : {}),
            
            // Update external ratings
            ratingImdb: media.ratingImdb,
            voteCountImdb: media.voteCountImdb,
            ratingTrakt: media.ratingTrakt,
            voteCountTrakt: media.voteCountTrakt,
            ratingMetacritic: media.ratingMetacritic,
            ratingRottenTomatoes: media.ratingRottenTomatoes,

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
          .where(inArray(schema.genres.tmdbId, media.genres.map((g) => g.tmdbId)));

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

      // Sync Watch Providers
      if (media.watchProviders && media.watchProviders.length > 0) {
        
        const uniqueProviders = Array.from(
          new Map(media.watchProviders.map(p => [p.providerId, p])).values()
        );
        
        // Upsert providers registry
        await tx
          .insert(schema.watchProviders)
          .values(uniqueProviders.map(p => ({
            tmdbId: p.providerId,
            name: p.name,
            logoPath: p.logoPath,
            displayPriority: p.displayPriority,
          })))
          .onConflictDoUpdate({
            target: schema.watchProviders.tmdbId,
            set: {
              name: sql`excluded.name`,
              logoPath: sql`excluded.logo_path`,
            }
          });

        // Get internal IDs
        const providerRows = await tx
          .select({ id: schema.watchProviders.id, tmdbId: schema.watchProviders.tmdbId })
          .from(schema.watchProviders)
          .where(inArray(schema.watchProviders.tmdbId, media.watchProviders.map(p => p.providerId)));
        
        const providerMap = new Map(providerRows.map(r => [r.tmdbId, r.id]));

        // Delete old links (clean slate for this media item)
        await tx
          .delete(schema.mediaWatchProviders)
          .where(eq(schema.mediaWatchProviders.mediaItemId, mediaId));

        // Insert new links
        const links = [];
        for (const p of media.watchProviders) {
          const internalId = providerMap.get(p.providerId);
          if (internalId) {
            links.push({
              mediaItemId: mediaId,
              providerId: internalId,
              type: p.type
            });
          }
        }
        
        if (links.length > 0) {
          await tx.insert(schema.mediaWatchProviders).values(links);
        }
      }
      });
    } catch (error) {
      this.logger.error(`Failed to upsert media ${media.title}: ${error.message}`);
      throw new DatabaseException(`Failed to upsert media: ${error.message}`, { 
        tmdbId: media.externalIds.tmdbId,
        title: media.title,
      });
    }
  }
}
