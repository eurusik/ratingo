import { type PersonDetails, type TmdbAdapter } from '../../../tmdb/public';
import { type IClockPort } from '../../../shared/clock';
import { PERSON_DETAILS_TTL_DAYS } from '../../domain/constants/person.constants';
import { type Person } from '../../domain/entities/person.entity';
import { PersonNotFoundError } from '../../domain/errors';
import { type IPersonRepository } from '../../domain/repositories/person.repository.interface';

import { PersonService } from './person.service';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function basePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: 'uuid-1',
    tmdbId: 287,
    slug: 'brad-pitt',
    name: 'Brad Pitt',
    profilePath: '/b.jpg',
    knownForDepartment: 'Acting',
    popularity: 10,
    biography: null,
    birthday: null,
    deathday: null,
    placeOfBirth: null,
    detailsFetchedAt: null,
    ...overrides,
  };
}

function setup(person: Person | null) {
  const repo: jest.Mocked<IPersonRepository> = {
    findByTmdbId: jest.fn().mockResolvedValue(person),
    writeMediaCredits: jest.fn(),
    updateDetails: jest.fn().mockResolvedValue(undefined),
    findEligibleCredits: jest.fn().mockResolvedValue({ items: [], total: 0 }),
  };
  const now = new Date('2026-06-23T00:00:00Z');
  const clock: IClockPort = { now: () => now };
  const tmdb = { getPerson: jest.fn() } as unknown as jest.Mocked<TmdbAdapter>;
  const service = new PersonService(repo, tmdb, clock);
  return { service, repo, tmdb, now };
}

describe('PersonService', () => {
  it('throws PersonNotFoundError when the person is absent', async () => {
    const { service } = setup(null);
    await expect(service.getByTmdbId(999)).rejects.toBeInstanceOf(PersonNotFoundError);
  });

  it('enriches biography on first read and persists it', async () => {
    const { service, repo, tmdb } = setup(basePerson({ detailsFetchedAt: null }));
    const details: PersonDetails = {
      tmdbId: 287,
      name: 'Brad Pitt',
      biography: 'An American actor.',
      birthday: new Date('1963-12-18'),
      deathday: null,
      placeOfBirth: 'Shawnee, Oklahoma, USA',
      profilePath: '/new.jpg',
      knownForDepartment: 'Acting',
      popularity: 42,
    };
    tmdb.getPerson.mockResolvedValue(details);

    const result = await service.getByTmdbId(287);

    expect(tmdb.getPerson).toHaveBeenCalledWith(287);
    expect(repo.updateDetails).toHaveBeenCalledWith(
      'uuid-1',
      expect.objectContaining({ biography: 'An American actor.', popularity: 42 }),
    );
    expect(result.biography).toBe('An American actor.');
  });

  it('does not re-fetch when details are fresh', async () => {
    const fresh = new Date('2026-06-20T00:00:00Z'); // 3 days ago
    const { service, tmdb, repo } = setup(
      basePerson({ detailsFetchedAt: fresh, biography: 'cached' }),
    );

    const result = await service.getByTmdbId(287);

    expect(tmdb.getPerson).not.toHaveBeenCalled();
    expect(repo.updateDetails).not.toHaveBeenCalled();
    expect(result.biography).toBe('cached');
  });

  it('re-fetches once details are older than the TTL', async () => {
    const stale = new Date(
      Date.parse('2026-06-23T00:00:00Z') - (PERSON_DETAILS_TTL_DAYS + 1) * MS_PER_DAY,
    );
    const { service, tmdb } = setup(basePerson({ detailsFetchedAt: stale }));
    tmdb.getPerson.mockResolvedValue(null);

    await service.getByTmdbId(287);

    expect(tmdb.getPerson).toHaveBeenCalledTimes(1);
  });

  it('returns the un-enriched person when TMDB enrichment fails', async () => {
    const { service, tmdb, repo } = setup(basePerson({ detailsFetchedAt: null }));
    tmdb.getPerson.mockRejectedValue(new Error('TMDB down'));

    const result = await service.getByTmdbId(287);

    expect(result.tmdbId).toBe(287);
    expect(repo.updateDetails).not.toHaveBeenCalled();
  });

  it('delegates credits listing to the repository', async () => {
    const { service, repo } = setup(basePerson());
    await service.getCredits(287, { limit: 20, offset: 0 });
    expect(repo.findEligibleCredits).toHaveBeenCalledWith('uuid-1', { limit: 20, offset: 0 });
  });
});
