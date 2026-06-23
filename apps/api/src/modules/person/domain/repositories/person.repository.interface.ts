import { type PersonCreditTypeValue } from '../constants/person.constants';
import { type Person, type PersonCreditsResult } from '../entities/person.entity';

export const PERSON_REPOSITORY = Symbol('PERSON_REPOSITORY');

/**
 * Minimal person identity extracted from credits during ingest.
 */
export interface PersonSeed {
  tmdbId: number;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
}

/**
 * One normalized credit row to persist for a media item.
 */
export interface CreditSeed {
  personTmdbId: number;
  creditType: PersonCreditTypeValue;
  character: string | null;
  job: string | null;
  department: string | null;
  order: number;
}

/**
 * Biography block enriched lazily from TMDB.
 */
export interface PersonDetailsUpdate {
  biography: string | null;
  birthday: Date | null;
  deathday: Date | null;
  placeOfBirth: string | null;
  knownForDepartment: string | null;
  popularity: number;
  profilePath: string | null;
  detailsFetchedAt: Date;
}

export interface PersonCreditsQueryOptions {
  limit: number;
  offset: number;
  creditType?: PersonCreditTypeValue;
}

export interface IPersonRepository {
  /** Look up a person by canonical TMDB id. */
  findByTmdbId(tmdbId: number): Promise<Person | null>;

  /**
   * Idempotently persists a media item's credits: upserts persons (without
   * touching the lazily-enriched biography block), then replaces all
   * media_credits rows for the media item (delete-then-insert).
   */
  writeMediaCredits(
    mediaItemId: string,
    persons: PersonSeed[],
    credits: CreditSeed[],
  ): Promise<void>;

  /** Persists the enriched biography block for a person. */
  updateDetails(personId: string, details: PersonDetailsUpdate): Promise<void>;

  /** Lists a person's catalog-eligible works. */
  findEligibleCredits(
    personId: string,
    options: PersonCreditsQueryOptions,
  ): Promise<PersonCreditsResult>;
}
