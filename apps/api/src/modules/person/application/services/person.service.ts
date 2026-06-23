import { Inject, Injectable, Logger } from '@nestjs/common';

import { MS_PER_DAY } from '../../../../common/constants';
import { CLOCK_PORT, type IClockPort } from '../../../shared/clock';
import { TmdbAdapter } from '../../../tmdb/public';
import { PERSON_DETAILS_TTL_DAYS } from '../../domain/constants/person.constants';
import { type Person, type PersonCreditsResult } from '../../domain/entities/person.entity';
import { PersonNotFoundError } from '../../domain/errors';
import {
  type IPersonRepository,
  type PersonCreditsQueryOptions,
  PERSON_REPOSITORY,
} from '../../domain/repositories/person.repository.interface';

/**
 * Read-side orchestration for the person page.
 *
 * The biography block is enriched lazily from TMDB on first request (and after
 * the TTL lapses); the result is persisted so subsequent reads hit the DB only.
 */
@Injectable()
export class PersonService {
  private readonly logger = new Logger(PersonService.name);

  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
    private readonly tmdbAdapter: TmdbAdapter,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  /**
   * Returns a person by TMDB id, enriching the biography block on demand.
   * @throws {PersonNotFoundError} when the person is not in the catalog.
   */
  async getByTmdbId(tmdbId: number): Promise<Person> {
    const person = await this.personRepository.findByTmdbId(tmdbId);
    if (!person) throw new PersonNotFoundError(tmdbId);

    if (!this.needsEnrichment(person)) return person;

    return this.enrich(person);
  }

  /**
   * Lists a person's catalog-eligible works.
   * @throws {PersonNotFoundError} when the person is not in the catalog.
   */
  async getCredits(
    tmdbId: number,
    options: PersonCreditsQueryOptions,
  ): Promise<PersonCreditsResult> {
    const person = await this.personRepository.findByTmdbId(tmdbId);
    if (!person) throw new PersonNotFoundError(tmdbId);

    return this.personRepository.findEligibleCredits(person.id, options);
  }

  private needsEnrichment(person: Person): boolean {
    if (!person.detailsFetchedAt) return true;
    const ageMs = this.clock.now().getTime() - person.detailsFetchedAt.getTime();
    return ageMs > PERSON_DETAILS_TTL_DAYS * MS_PER_DAY;
  }

  /** Best-effort TMDB enrichment — failures return the un-enriched person. */
  private async enrich(person: Person): Promise<Person> {
    try {
      const details = await this.tmdbAdapter.getPerson(person.tmdbId);
      if (!details) return person;

      const now = this.clock.now();
      const knownForDepartment = details.knownForDepartment ?? person.knownForDepartment;
      const profilePath = details.profilePath ?? person.profilePath;

      await this.personRepository.updateDetails(person.id, {
        biography: details.biography,
        birthday: details.birthday,
        deathday: details.deathday,
        placeOfBirth: details.placeOfBirth,
        knownForDepartment,
        popularity: details.popularity,
        profilePath,
        detailsFetchedAt: now,
      });

      return {
        ...person,
        biography: details.biography,
        birthday: details.birthday,
        deathday: details.deathday,
        placeOfBirth: details.placeOfBirth,
        knownForDepartment,
        popularity: details.popularity,
        profilePath,
        detailsFetchedAt: now,
      };
    } catch (error) {
      this.logger.warn(
        `Person enrichment failed for tmdbId=${person.tmdbId}: ${(error as Error).message}`,
      );
      return person;
    }
  }
}
