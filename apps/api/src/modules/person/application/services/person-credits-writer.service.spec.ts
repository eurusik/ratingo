import * as fc from 'fast-check';

import { type Credits } from '../../../ingestion/public';
import { PersonCreditType } from '../../domain/constants/person.constants';
import {
  type CreditSeed,
  type IPersonRepository,
  type PersonSeed,
} from '../../domain/repositories/person.repository.interface';

import { PersonCreditsWriterService } from './person-credits-writer.service';

interface Captured {
  mediaItemId: string;
  persons: PersonSeed[];
  credits: CreditSeed[];
}

function makeService(): { service: PersonCreditsWriterService; calls: Captured[] } {
  const calls: Captured[] = [];
  const repo: IPersonRepository = {
    findByTmdbId: jest.fn(),
    updateDetails: jest.fn(),
    findEligibleCredits: jest.fn(),
    writeMediaCredits: jest.fn(async (mediaItemId, persons, credits) => {
      calls.push({ mediaItemId, persons, credits });
    }),
  };
  return { service: new PersonCreditsWriterService(repo), calls };
}

describe('PersonCreditsWriterService', () => {
  it('maps cast and crew into person + credit seeds', async () => {
    const { service, calls } = makeService();
    const credits: Credits = {
      cast: [{ tmdbId: 1, name: 'Brad Pitt', character: 'Tyler', profilePath: '/b.jpg', order: 0 }],
      crew: [
        {
          tmdbId: 2,
          name: 'David Fincher',
          job: 'Director',
          department: 'Directing',
          profilePath: '/d.jpg',
        },
      ],
    };

    await service.writeFromCredits('media-1', credits);

    expect(calls).toHaveLength(1);
    const { persons, credits: seeds } = calls[0];
    expect(persons.map((p) => p.tmdbId).sort()).toEqual([1, 2]);
    expect(seeds).toContainEqual(
      expect.objectContaining({
        personTmdbId: 1,
        creditType: PersonCreditType.CAST,
        character: 'Tyler',
        job: null,
        order: 0,
      }),
    );
    expect(seeds).toContainEqual(
      expect.objectContaining({
        personTmdbId: 2,
        creditType: PersonCreditType.CREW,
        job: 'Director',
        department: 'Directing',
        character: null,
      }),
    );
  });

  it('clears credits for empty input', async () => {
    const { service, calls } = makeService();
    await service.writeFromCredits('media-1', { cast: [], crew: [] });
    expect(calls[0]).toEqual({ mediaItemId: 'media-1', persons: [], credits: [] });
  });

  it('handles null credits as a clear', async () => {
    const { service, calls } = makeService();
    await service.writeFromCredits('media-1', null);
    expect(calls[0]).toEqual({ mediaItemId: 'media-1', persons: [], credits: [] });
  });

  it('skips crew members without a job', async () => {
    const { service, calls } = makeService();
    await service.writeFromCredits('media-1', {
      cast: [],
      crew: [{ tmdbId: 5, name: 'Nobody', job: '', department: '', profilePath: null }],
    });
    expect(calls[0].credits).toHaveLength(0);
  });

  describe('property-based invariants', () => {
    const castArb = fc.record({
      tmdbId: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      character: fc.string({ maxLength: 20 }),
      profilePath: fc.option(fc.string(), { nil: null }),
      order: fc.nat({ max: 50 }),
    });
    const crewArb = fc.record({
      tmdbId: fc.integer({ min: 1, max: 1000 }),
      name: fc.string({ minLength: 1, maxLength: 20 }),
      job: fc.constantFrom('Director', 'Writer', 'Producer'),
      department: fc.string({ minLength: 1, maxLength: 20 }),
      profilePath: fc.option(fc.string(), { nil: null }),
    });

    it('person seeds are unique by tmdbId and cover every credited person', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(castArb, { maxLength: 15 }),
          fc.array(crewArb, { maxLength: 15 }),
          async (cast, crew) => {
            const { service, calls } = makeService();
            await service.writeFromCredits('m', { cast, crew });

            const { persons, credits } = calls[0];
            const seedIds = persons.map((p) => p.tmdbId);

            // unique person seeds
            expect(new Set(seedIds).size).toBe(seedIds.length);

            // every credited tmdbId has exactly one seed
            const creditedIds = new Set([
              ...cast.map((c) => c.tmdbId),
              ...crew.map((c) => c.tmdbId),
            ]);
            expect(new Set(seedIds)).toEqual(creditedIds);

            // every credit seed references a known person
            for (const c of credits) {
              expect(creditedIds.has(c.personTmdbId)).toBe(true);
            }
          },
        ),
      );
    });
  });
});
