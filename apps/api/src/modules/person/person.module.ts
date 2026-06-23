import { Module } from '@nestjs/common';

import { TmdbModule } from '../tmdb/tmdb.module';

import { PersonCreditsWriterService } from './application/services/person-credits-writer.service';
import { PersonService } from './application/services/person.service';
import { PERSON_CREDITS_WRITER } from './domain/ports/person-credits-writer.port';
import { PERSON_REPOSITORY } from './domain/repositories/person.repository.interface';
import { PersonCreditsQuery } from './infrastructure/queries/person-credits.query';
import { DrizzlePersonRepository } from './infrastructure/repositories/drizzle-person.repository';
import { PersonController } from './presentation/controllers/person.controller';

@Module({
  imports: [TmdbModule],
  controllers: [PersonController],
  providers: [
    PersonCreditsQuery,
    { provide: PERSON_REPOSITORY, useClass: DrizzlePersonRepository },
    PersonService,
    PersonCreditsWriterService,
    { provide: PERSON_CREDITS_WRITER, useExisting: PersonCreditsWriterService },
  ],
  exports: [PERSON_CREDITS_WRITER],
})
export class PersonModule {}
