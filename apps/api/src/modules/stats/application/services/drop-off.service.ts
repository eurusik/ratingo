import { Inject, Injectable, Logger } from '@nestjs/common';
import { TraktAdapter } from '@/modules/ingestion/infrastructure/adapters/trakt/trakt.adapter';
import { DropOffAnalyzerService, DropOffAnalysis } from '@/modules/shared/drop-off-analyzer';
import { DATABASE_CONNECTION } from '@/database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/database/schema';
import { eq } from 'drizzle-orm';
import { MediaType } from '@/common/enums/media-type.enum';

/**
 * Service for orchestrating drop-off analysis for shows.
 * Fetches episode data from Trakt, analyzes it, and stores results.
 */
@Injectable()
export class DropOffService {
  private readonly logger = new Logger(DropOffService.name);

  constructor(
    private readonly traktAdapter: TraktAdapter,
    private readonly dropOffAnalyzer: DropOffAnalyzerService,
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  /**
   * Analyzes drop-off for a single show by TMDB ID.
   * Fetches episodes from Trakt, analyzes, and stores result.
   */
  async analyzeShow(tmdbId: number): Promise<DropOffAnalysis | null> {
    this.logger.debug(`Analyzing drop-off for show ${tmdbId}...`);

    try {
      // 1. Fetch episode data from Trakt
      const episodeData = await this.traktAdapter.getShowEpisodesForAnalysis(tmdbId);
      if (!episodeData || !episodeData.seasons.length) {
        this.logger.warn(`No episode data for show ${tmdbId}`);
        return null;
      }

      // 2. Analyze drop-off
      const analysis = this.dropOffAnalyzer.analyze(episodeData.seasons);

      // 3. Store in database
      await this.saveAnalysis(tmdbId, analysis);

      this.logger.log(
        `Analyzed show ${tmdbId}: ${analysis.insight} (${analysis.episodesAnalyzed} episodes)`
      );

      return analysis;
    } catch (error) {
      this.logger.error(`Failed to analyze show ${tmdbId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Analyzes drop-off for all shows in the database.
   * Used by background job.
   */
  async analyzeAllShows(limit = 50): Promise<{ analyzed: number; failed: number }> {
    this.logger.log(`Starting drop-off analysis for up to ${limit} shows...`);

    // Get shows that need analysis (no analysis or old analysis)
    const shows = await this.db
      .select({
        tmdbId: schema.mediaItems.tmdbId,
        title: schema.mediaItems.title,
      })
      .from(schema.mediaItems)
      .innerJoin(schema.shows, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(eq(schema.mediaItems.type, MediaType.SHOW))
      .limit(limit);

    let analyzed = 0;
    let failed = 0;

    for (const show of shows) {
      const result = await this.analyzeShow(show.tmdbId);
      if (result) {
        analyzed++;
      } else {
        failed++;
      }

      // Rate limiting: wait 500ms between API calls
      await new Promise(r => setTimeout(r, 500));
    }

    this.logger.log(`Drop-off analysis complete: ${analyzed} analyzed, ${failed} failed`);
    return { analyzed, failed };
  }

  /**
   * Saves drop-off analysis to the shows table.
   * Uses single query with subquery for efficiency.
   */
  private async saveAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
    // Single UPDATE with subquery - no need for separate SELECT
    await this.db
      .update(schema.shows)
      .set({ dropOffAnalysis: analysis })
      .where(
        eq(
          schema.shows.mediaItemId,
          this.db
            .select({ id: schema.mediaItems.id })
            .from(schema.mediaItems)
            .where(eq(schema.mediaItems.tmdbId, tmdbId))
            .limit(1)
        )
      );
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   * Returns cached analysis from database.
   */
  async getAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    const result = await this.db
      .select({ dropOffAnalysis: schema.shows.dropOffAnalysis })
      .from(schema.shows)
      .innerJoin(schema.mediaItems, eq(schema.shows.mediaItemId, schema.mediaItems.id))
      .where(eq(schema.mediaItems.tmdbId, tmdbId))
      .limit(1);

    return result[0]?.dropOffAnalysis || null;
  }
}
