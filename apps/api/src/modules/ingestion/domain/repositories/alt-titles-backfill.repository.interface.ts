import { type MediaType } from '../../../../common/enums/media-type.enum';

import { type BackfillPage } from './backfill-page.interface';

export interface AltTitlesBackfillCandidate {
  id: string;
  tmdbId: number | null;
  type: MediaType;
  title: string;
  originalTitle: string | null;
}

export interface IAltTitlesBackfillRepository {
  findCandidates(page: BackfillPage): Promise<AltTitlesBackfillCandidate[]>;
}

export const ALT_TITLES_BACKFILL_REPOSITORY = Symbol('ALT_TITLES_BACKFILL_REPOSITORY');
