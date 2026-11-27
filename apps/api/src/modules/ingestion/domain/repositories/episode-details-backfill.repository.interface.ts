import {
  type EpisodeDetailsBackfillCandidate,
  type EpisodeDetailsUpdate,
  type StoredEpisode,
} from '../models/episode-details.model';

import { type BackfillPage } from './backfill-page.interface';

export interface IEpisodeDetailsBackfillRepository {
  findCandidates(page: BackfillPage): Promise<EpisodeDetailsBackfillCandidate[]>;
  findEpisodes(showId: string): Promise<StoredEpisode[]>;
  updateEpisodeDetails(updates: readonly EpisodeDetailsUpdate[]): Promise<void>;
  fillSeasonAirDatesFromEpisodes(): Promise<number>;
}

export const EPISODE_DETAILS_BACKFILL_REPOSITORY = Symbol('EPISODE_DETAILS_BACKFILL_REPOSITORY');
