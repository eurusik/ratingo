import { Injectable } from '@nestjs/common';

import { ENGLISH_LANGUAGE } from '@/common/constants';
import { renumberedSeasons } from '@/modules/ingestion/domain/episode-pairing';
import { type TmdbEpisodeSources } from '@/modules/ingestion/domain/models/episode-sources.model';
import { TmdbAdapter } from '@/modules/tmdb/public';

@Injectable()
export class TmdbEpisodeSourcesService {
  constructor(private readonly tmdbAdapter: TmdbAdapter) {}

  async fetch(
    tmdbId: number,
    episodeCounts: ReadonlyMap<number, number>,
  ): Promise<TmdbEpisodeSources> {
    const localized = await this.tmdbAdapter.getSeasonsEpisodes(tmdbId, [...episodeCounts.keys()]);
    const renumbered = renumberedSeasons(episodeCounts, localized.episodesBySeason);
    if (renumbered.length === 0) {
      return {
        episodes: { localized: localized.episodesBySeason, english: new Map() },
        failedSeasons: localized.failedSeasons,
      };
    }

    const english = await this.tmdbAdapter.getSeasonsEpisodes(tmdbId, renumbered, ENGLISH_LANGUAGE);
    return {
      episodes: { localized: localized.episodesBySeason, english: english.episodesBySeason },
      failedSeasons: [...localized.failedSeasons, ...english.failedSeasons],
    };
  }
}
