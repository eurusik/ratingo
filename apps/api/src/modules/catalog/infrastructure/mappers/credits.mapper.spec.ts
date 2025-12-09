import { CreditsMapper } from './credits.mapper';
import { Credits } from '../../../../database/schema';

describe('CreditsMapper', () => {
  it('should map cast members correctly with slug and personId', () => {
    const credits: Credits = {
      cast: [
        {
          tmdbId: 123,
          name: 'Brad Pitt',
          character: 'Tyler Durden',
          profilePath: '/brad.jpg',
          order: 0,
        },
      ],
      crew: [],
    };

    const result = CreditsMapper.toDto(credits);

    expect(result?.cast[0]).toEqual({
      tmdbId: 123,
      personId: 'tmdb:123',
      slug: 'brad-pitt',
      name: 'Brad Pitt',
      character: 'Tyler Durden',
      profilePath: '/brad.jpg',
      order: 0,
    });
  });

  it('should map crew members correctly with slug and personId', () => {
    const credits: Credits = {
      cast: [],
      crew: [
        {
          tmdbId: 456,
          name: 'David Fincher',
          job: 'Director',
          department: 'Directing',
          profilePath: '/david.jpg',
        },
      ],
    };

    const result = CreditsMapper.toDto(credits);

    expect(result?.crew[0]).toEqual({
      tmdbId: 456,
      personId: 'tmdb:456',
      slug: 'david-fincher',
      name: 'David Fincher',
      job: 'Director',
      department: 'Directing',
      profilePath: '/david.jpg',
    });
  });

  it('should return null slug for non-Latin characters if transliteration is missing', () => {
    const credits: Credits = {
      cast: [
        { tmdbId: 1, name: 'Джинніфер Ґудвін', order: 0, character: '', profilePath: '' },
      ],
      crew: [],
    };

    const result = CreditsMapper.toDto(credits);

    expect(result?.cast[0].slug).toBeNull();
  });

  it('should generate slugs correctly handling special characters', () => {
    const credits: Credits = {
      cast: [
        { tmdbId: 1, name: 'Robert Downey Jr.', order: 0, character: '', profilePath: '' },
        { tmdbId: 2, name: 'Lupita Nyong\'o', order: 1, character: '', profilePath: '' },
        { tmdbId: 3, name: 'Mads Mikkelsen', order: 2, character: '', profilePath: '' },
      ],
      crew: [],
    };

    const result = CreditsMapper.toDto(credits);

    expect(result?.cast[0].slug).toBe('robert-downey-jr');
    expect(result?.cast[1].slug).toBe('lupita-nyongo');
    expect(result?.cast[2].slug).toBe('mads-mikkelsen');
  });

  it('should return null if input is null', () => {
    expect(CreditsMapper.toDto(null)).toBeNull();
  });
});
