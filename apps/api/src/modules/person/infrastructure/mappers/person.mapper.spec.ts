import { mapPerson, type PersonRow } from './person.mapper';

const row: PersonRow = {
  id: 'uuid-1',
  tmdbId: 287,
  slug: 'brad-pitt',
  name: 'Brad Pitt',
  profilePath: '/b.jpg',
  knownForDepartment: 'Acting',
  popularity: 12.5,
  biography: 'Bio',
  birthday: new Date('1963-12-18'),
  deathday: null,
  placeOfBirth: 'USA',
  detailsFetchedAt: new Date('2026-06-23'),
};

describe('mapPerson', () => {
  it('maps a row to the Person entity', () => {
    expect(mapPerson(row)).toEqual({
      id: 'uuid-1',
      tmdbId: 287,
      slug: 'brad-pitt',
      name: 'Brad Pitt',
      profilePath: '/b.jpg',
      knownForDepartment: 'Acting',
      popularity: 12.5,
      biography: 'Bio',
      birthday: new Date('1963-12-18'),
      deathday: null,
      placeOfBirth: 'USA',
      detailsFetchedAt: new Date('2026-06-23'),
    });
  });

  it('coerces null popularity to 0', () => {
    expect(mapPerson({ ...row, popularity: null }).popularity).toBe(0);
  });
});
