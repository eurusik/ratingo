import { MediaType } from '../../../../common/enums/media-type.enum';
import { type Person, type PersonCreditItem } from '../../domain/entities/person.entity';

import { toPersonCreditItemDto, toPersonResponseDto } from './person-response.mapper';

const person: Person = {
  id: 'uuid-1',
  tmdbId: 287,
  slug: 'brad-pitt',
  name: 'Brad Pitt',
  profilePath: '/b.jpg',
  knownForDepartment: 'Acting',
  popularity: 10,
  biography: 'Bio',
  birthday: new Date('1963-12-18'),
  deathday: null,
  placeOfBirth: 'USA',
  detailsFetchedAt: new Date('2026-06-23'),
};

describe('toPersonResponseDto', () => {
  it('maps a person and builds the profile image set', () => {
    const dto = toPersonResponseDto(person);
    expect(dto).toMatchObject({
      tmdbId: 287,
      slug: 'brad-pitt',
      name: 'Brad Pitt',
      knownForDepartment: 'Acting',
      biography: 'Bio',
      placeOfBirth: 'USA',
      popularity: 10,
    });
    expect(dto.profile?.small).toContain('/b.jpg');
    expect(dto.profile?.original).toContain('/b.jpg');
  });

  it('returns null profile when there is no profile path', () => {
    expect(toPersonResponseDto({ ...person, profilePath: null }).profile).toBeNull();
  });
});

describe('toPersonCreditItemDto', () => {
  const credit: PersonCreditItem = {
    mediaItemId: 'm-1',
    type: MediaType.MOVIE,
    tmdbId: 550,
    title: 'Fight Club',
    slug: 'fight-club',
    posterPath: '/p.jpg',
    releaseDate: new Date('1999-10-15'),
    ratingoScore: 0.9,
    character: 'Tyler Durden',
    jobs: ['Director'],
  };

  it('maps a credit item and exposes mediaItemId as id', () => {
    const dto = toPersonCreditItemDto(credit);
    expect(dto).toMatchObject({
      id: 'm-1',
      type: MediaType.MOVIE,
      tmdbId: 550,
      title: 'Fight Club',
      slug: 'fight-club',
      character: 'Tyler Durden',
      jobs: ['Director'],
      ratingoScore: 0.9,
    });
    expect(dto.poster?.medium).toContain('/p.jpg');
  });

  it('returns null poster when there is no poster path', () => {
    expect(toPersonCreditItemDto({ ...credit, posterPath: null }).poster).toBeNull();
  });
});
