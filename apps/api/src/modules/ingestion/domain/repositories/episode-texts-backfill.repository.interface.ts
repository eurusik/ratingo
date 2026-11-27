import {
  type EpisodeTextsBackfillCandidate,
  type EpisodeTextUpdate,
  type StoredEpisodeText,
} from '../models/episode-text.model';

import { type BackfillPage } from './backfill-page.interface';

export interface IEpisodeTextsBackfillRepository {
  findCandidates(page: BackfillPage): Promise<EpisodeTextsBackfillCandidate[]>;
  findEpisodes(showId: string): Promise<StoredEpisodeText[]>;
  updateEpisodeTexts(updates: readonly EpisodeTextUpdate[]): Promise<void>;
}

export const EPISODE_TEXTS_BACKFILL_REPOSITORY = Symbol('EPISODE_TEXTS_BACKFILL_REPOSITORY');
