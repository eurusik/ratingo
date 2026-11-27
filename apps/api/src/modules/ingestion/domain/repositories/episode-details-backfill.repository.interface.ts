import {
  type EpisodeDetailsBackfillCandidate,
  type EpisodeDetailsCandidatePage,
  type EpisodeDetailsUpdate,
  type EpisodeTitleRepairCandidate,
  type StoredEpisode,
} from '../models/episode-details.model';

import { type BackfillPage } from './backfill-page.interface';

export interface IEpisodeDetailsBackfillRepository {
  findCandidates(page: EpisodeDetailsCandidatePage): Promise<EpisodeDetailsBackfillCandidate[]>;
  findTitleRepairCandidates(page: BackfillPage): Promise<EpisodeTitleRepairCandidate[]>;
  findEpisodes(showId: string): Promise<StoredEpisode[]>;
  updateEpisodeDetails(updates: readonly EpisodeDetailsUpdate[]): Promise<number>;
  markChecked(showId: string, checkedAt: Date): Promise<void>;
  fillSeasonAirDatesFromEpisodes(): Promise<number>;
}

export const EPISODE_DETAILS_BACKFILL_REPOSITORY = Symbol('EPISODE_DETAILS_BACKFILL_REPOSITORY');
