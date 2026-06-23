import { MediaType } from '../../../../common/enums/media-type.enum';
import { type PersonService } from '../../application/services/person.service';
import { type Person, type PersonCreditItem } from '../../domain/entities/person.entity';

import { PersonController } from './person.controller';

function makeController(service: Partial<PersonService>): PersonController {
  return new PersonController(service as PersonService);
}

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

const creditItem: PersonCreditItem = {
  mediaItemId: 'm-1',
  type: MediaType.MOVIE,
  tmdbId: 550,
  title: 'Fight Club',
  slug: 'fight-club',
  posterPath: '/p.jpg',
  releaseDate: new Date('1999-10-15'),
  ratingoScore: 0.9,
  character: 'Tyler Durden',
  jobs: [],
};

describe('PersonController', () => {
  it('returns mapped person details with a profile image', async () => {
    const controller = makeController({ getByTmdbId: jest.fn().mockResolvedValue(person) });

    const result = await controller.getPerson(287);

    expect(result.tmdbId).toBe(287);
    expect(result.name).toBe('Brad Pitt');
    expect(result.profile?.medium).toContain('/b.jpg');
    expect(result.biography).toBe('Bio');
  });

  it('returns credits with correct pagination meta', async () => {
    const getCredits = jest.fn().mockResolvedValue({ items: [creditItem], total: 5 });
    const controller = makeController({ getCredits });

    const result = await controller.getPersonCredits(287, { limit: 1, offset: 0 });

    expect(getCredits).toHaveBeenCalledWith(287, { limit: 1, offset: 0, creditType: undefined });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ id: 'm-1', character: 'Tyler Durden' });
    expect(result.meta).toEqual({ count: 1, total: 5, limit: 1, offset: 0, hasMore: true });
  });

  it('reports hasMore=false on the last page', async () => {
    const getCredits = jest.fn().mockResolvedValue({ items: [creditItem], total: 3 });
    const controller = makeController({ getCredits });

    const result = await controller.getPersonCredits(287, { limit: 10, offset: 2 });

    expect(result.meta.hasMore).toBe(false);
  });
});
