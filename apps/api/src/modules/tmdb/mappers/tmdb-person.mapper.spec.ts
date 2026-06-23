import { type TmdbPersonResponse } from '../types/tmdb-api.types';

import { TmdbMapper } from './tmdb.mapper';

describe('TmdbMapper.toPersonDetails', () => {
  const raw: TmdbPersonResponse = {
    id: 287,
    name: 'Brad Pitt',
    biography: '  An American actor.  ',
    birthday: '1963-12-18',
    deathday: null,
    place_of_birth: 'Shawnee, Oklahoma, USA',
    profile_path: '/b.jpg',
    known_for_department: 'Acting',
    popularity: 42.5,
  };

  it('maps a full person response and trims biography', () => {
    const result = TmdbMapper.toPersonDetails(raw);
    expect(result).toEqual({
      tmdbId: 287,
      name: 'Brad Pitt',
      biography: 'An American actor.',
      birthday: new Date('1963-12-18'),
      deathday: null,
      placeOfBirth: 'Shawnee, Oklahoma, USA',
      profilePath: '/b.jpg',
      knownForDepartment: 'Acting',
      popularity: 42.5,
    });
  });

  it('returns null for missing identity', () => {
    expect(TmdbMapper.toPersonDetails(null)).toBeNull();
    expect(TmdbMapper.toPersonDetails({ ...raw, name: '' } as TmdbPersonResponse)).toBeNull();
  });

  it('normalizes empty biography to null', () => {
    const result = TmdbMapper.toPersonDetails({ ...raw, biography: '   ' });
    expect(result?.biography).toBeNull();
  });
});
