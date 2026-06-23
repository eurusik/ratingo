import { Inject, Injectable } from '@nestjs/common';

import { generateSlug } from '../../../catalog/public';
import { type Credits } from '../../../ingestion/public';
import { PersonCreditType } from '../../domain/constants/person.constants';
import { type IPersonCreditsWriter } from '../../domain/ports/person-credits-writer.port';
import {
  type CreditSeed,
  type IPersonRepository,
  type PersonSeed,
  PERSON_REPOSITORY,
} from '../../domain/repositories/person.repository.interface';

/**
 * Normalizes a media item's credits JSONB into the persons / media_credits
 * read-model. Shared by the ingestion pipeline and the backfill job. Performs
 * no external calls — the data is already in hand.
 */
@Injectable()
export class PersonCreditsWriterService implements IPersonCreditsWriter {
  constructor(
    @Inject(PERSON_REPOSITORY)
    private readonly personRepository: IPersonRepository,
  ) {}

  async writeFromCredits(mediaItemId: string, credits: Credits | null): Promise<void> {
    const cast = credits?.cast ?? [];
    const crew = credits?.crew ?? [];

    if (cast.length === 0 && crew.length === 0) {
      // Still clear any stale credits for this media item.
      await this.personRepository.writeMediaCredits(mediaItemId, [], []);
      return;
    }

    const seedsByTmdb = new Map<number, PersonSeed>();
    const creditSeeds: CreditSeed[] = [];

    for (const member of cast) {
      if (!member.tmdbId) continue;
      this.collectPerson(seedsByTmdb, member.tmdbId, member.name, member.profilePath);
      creditSeeds.push({
        personTmdbId: member.tmdbId,
        creditType: PersonCreditType.CAST,
        character: member.character || null,
        job: null,
        department: null,
        order: member.order ?? 0,
      });
    }

    for (const member of crew) {
      if (!member.tmdbId || !member.job) continue;
      this.collectPerson(seedsByTmdb, member.tmdbId, member.name, member.profilePath);
      creditSeeds.push({
        personTmdbId: member.tmdbId,
        creditType: PersonCreditType.CREW,
        character: null,
        job: member.job,
        department: member.department || null,
        order: 0,
      });
    }

    await this.personRepository.writeMediaCredits(
      mediaItemId,
      [...seedsByTmdb.values()],
      creditSeeds,
    );
  }

  private collectPerson(
    seeds: Map<number, PersonSeed>,
    tmdbId: number,
    name: string,
    profilePath: string | null,
  ): void {
    if (seeds.has(tmdbId)) return;
    seeds.set(tmdbId, {
      tmdbId,
      slug: generateSlug(name, tmdbId),
      name,
      profilePath: profilePath ?? null,
      knownForDepartment: null,
    });
  }
}
