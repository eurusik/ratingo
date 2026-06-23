/**
 * Normalized person details returned by TmdbAdapter.getPerson().
 *
 * This is the boundary type consumed by the person module — raw TMDB shapes
 * stay internal to the tmdb module.
 */
export interface PersonDetails {
  tmdbId: number;
  name: string;
  biography: string | null;
  birthday: Date | null;
  deathday: Date | null;
  placeOfBirth: string | null;
  profilePath: string | null;
  knownForDepartment: string | null;
  popularity: number;
}
