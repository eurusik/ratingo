import { ImageMapper } from '../../../../common/mappers/image.mapper';
import { type Person, type PersonCreditItem } from '../../domain/entities/person.entity';
import { type PersonCreditItemDto } from '../dtos/person-credits-response.dto';
import { type PersonResponseDto } from '../dtos/person-response.dto';

/**
 * Maps a Person domain entity to its API response shape.
 */
export function toPersonResponseDto(person: Person): PersonResponseDto {
  return {
    tmdbId: person.tmdbId,
    slug: person.slug,
    name: person.name,
    profile: ImageMapper.toPoster(person.profilePath),
    knownForDepartment: person.knownForDepartment,
    biography: person.biography,
    birthday: person.birthday,
    deathday: person.deathday,
    placeOfBirth: person.placeOfBirth,
    popularity: person.popularity,
  };
}

/**
 * Maps a person credit item to its API response shape.
 */
export function toPersonCreditItemDto(item: PersonCreditItem): PersonCreditItemDto {
  return {
    id: item.mediaItemId,
    type: item.type,
    tmdbId: item.tmdbId,
    title: item.title,
    slug: item.slug,
    poster: ImageMapper.toPoster(item.posterPath),
    releaseDate: item.releaseDate,
    ratingoScore: item.ratingoScore,
    character: item.character,
    jobs: item.jobs,
  };
}
