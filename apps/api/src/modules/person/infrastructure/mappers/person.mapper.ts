import { type Person } from '../../domain/entities/person.entity';

/**
 * Raw `persons` row shape (subset selected by the repository).
 */
export interface PersonRow {
  id: string;
  tmdbId: number;
  slug: string;
  name: string;
  profilePath: string | null;
  knownForDepartment: string | null;
  popularity: number | null;
  biography: string | null;
  birthday: Date | null;
  deathday: Date | null;
  placeOfBirth: string | null;
  detailsFetchedAt: Date | null;
}

/**
 * Maps a raw persons row to the Person domain entity.
 */
export function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    tmdbId: row.tmdbId,
    slug: row.slug,
    name: row.name,
    profilePath: row.profilePath,
    knownForDepartment: row.knownForDepartment,
    popularity: row.popularity ?? 0,
    biography: row.biography,
    birthday: row.birthday,
    deathday: row.deathday,
    placeOfBirth: row.placeOfBirth,
    detailsFetchedAt: row.detailsFetchedAt,
  };
}
