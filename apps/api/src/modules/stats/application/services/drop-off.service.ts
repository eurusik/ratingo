import { Inject, Injectable, Logger } from '@nestjs/common';
import { TraktAdapter } from '../../../ingestion/infrastructure/adapters/trakt/trakt.adapter';
import { DropOffAnalyzerService, DropOffAnalysis } from '../../../shared/drop-off-analyzer';
import { IShowRepository, SHOW_REPOSITORY } from '../../../catalog/domain/repositories/show.repository.interface';

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
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
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

    // Get shows that need analysis
    const shows = await this.showRepository.findShowsForAnalysis(limit);

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
   */
  private async saveAnalysis(tmdbId: number, analysis: DropOffAnalysis): Promise<void> {
    await this.showRepository.saveDropOffAnalysis(tmdbId, analysis);
  }

  /**
   * Gets drop-off analysis for a show by TMDB ID.
   * Returns cached analysis from database.
   */
  async getAnalysis(tmdbId: number): Promise<DropOffAnalysis | null> {
    return this.showRepository.getDropOffAnalysis(tmdbId);
  }
}
