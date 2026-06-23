import { type MediaType } from '../../../../common/enums/media-type.enum';

/**
 * A person (actor, director, crew member) as stored in the catalog.
 */
export interface Person {
  id: string;
  tmdbId: number;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  popularity: number;
  biography: string | null;
  birthday: Date | null;
  deathday: Date | null;
  placeOfBirth: string | null;
  /** null = biography never enriched from TMDB. */
  detailsFetchedAt: Date | null;
}

/**
 * One work in a person's filmography (one row per title), restricted to
 * catalog-eligible media. A person may contribute as both cast and crew on the
 * same title — those are merged here into a single entry.
 */
export interface PersonCreditItem {
  mediaItemId: string;
  type: MediaType;
  tmdbId: number;
  title: string;
  slug: string;
  posterPath: string | null;
  releaseDate: Date | null;
  ratingoScore: number | null;
  /** Cast character on this title, if the person acted in it. */
  character: string | null;
  /** Crew jobs on this title (e.g. Director, Creator); empty if none. */
  jobs: string[];
}

/**
 * Paginated result of a person's catalog credits.
 */
export interface PersonCreditsResult {
  items: PersonCreditItem[];
  total: number;
}
