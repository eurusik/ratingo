import { Controller, Get, Param, ParseIntPipe, Query, UseFilters } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { PersonService } from '../../application/services/person.service';
import {
  PaginatedPersonCreditsResponseDto,
  PersonCreditsQueryDto,
  PersonResponseDto,
} from '../dtos';
import { PersonDomainExceptionFilter } from '../filters/person-domain-exception.filter';
import { toPersonCreditItemDto, toPersonResponseDto } from '../mappers/person-response.mapper';

@ApiTags('Public: Persons')
@UseFilters(PersonDomainExceptionFilter)
@Controller('persons')
export class PersonController {
  constructor(private readonly personService: PersonService) {}

  @Get(':tmdbId')
  @ApiOperation({
    summary: 'Get person details by TMDB id',
    description:
      'Returns photo, biography and vital data for an actor/crew member. ' +
      'Biography is enriched from TMDB lazily on first request.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, example: 287 })
  @ApiOkResponse({ type: PersonResponseDto })
  async getPerson(@Param('tmdbId', ParseIntPipe) tmdbId: number): Promise<PersonResponseDto> {
    const person = await this.personService.getByTmdbId(tmdbId);
    return toPersonResponseDto(person);
  }

  @Get(':tmdbId/credits')
  @ApiOperation({
    summary: "Get a person's catalog works",
    description:
      "Lists the person's works that exist in the Ratingo catalog (eligible titles only), " +
      'sorted by Ratingo score then release date. Filter with creditType=cast|crew.',
  })
  @ApiParam({ name: 'tmdbId', type: Number, example: 287 })
  @ApiOkResponse({ type: PaginatedPersonCreditsResponseDto })
  async getPersonCredits(
    @Param('tmdbId', ParseIntPipe) tmdbId: number,
    @Query() query: PersonCreditsQueryDto,
  ): Promise<PaginatedPersonCreditsResponseDto> {
    const { items, total } = await this.personService.getCredits(tmdbId, {
      limit: query.limit,
      offset: query.offset,
      creditType: query.creditType,
    });

    return {
      data: items.map(toPersonCreditItemDto),
      meta: {
        count: items.length,
        total,
        limit: query.limit,
        offset: query.offset,
        hasMore: query.offset + items.length < total,
      },
    };
  }
}
