import { type BackfillPage } from './backfill-page.interface';

export interface ImdbBackfillCandidate {
  id: string;
  tmdbId: number | null;
}

export interface IImdbBackfillRepository {
  findShowCandidates(page: BackfillPage): Promise<ImdbBackfillCandidate[]>;
  saveShowImdbId(tmdbId: number, imdbId: string): Promise<void>;
}

export const IMDB_BACKFILL_REPOSITORY = Symbol('IMDB_BACKFILL_REPOSITORY');
