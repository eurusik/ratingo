import { Controller, Get, HttpStatus, Query, UseFilters, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CATALOG_MAX_CALENDAR_DAYS } from '@/common/constants';
import { ErrorCode } from '@/common/enums/error-code.enum';
import { AppException } from '@/common/exceptions/app.exception';
import { CurrentUser, OptionalJwtAuthGuard } from '@/modules/auth/public';
import { CatalogCalendarService } from '@/modules/catalog/application/services/catalog-calendar.service';

import { CatalogCalendarQueryDto, CatalogCalendarResponseDto } from '../dtos/catalog-calendar.dto';
import { CatalogDomainExceptionFilter } from '../filters';

@ApiTags('Public: Catalog')
@UseGuards(OptionalJwtAuthGuard)
@UseFilters(CatalogDomainExceptionFilter)
@Controller('catalog/calendar')
export class CatalogCalendarController {
  constructor(private readonly calendarService: CatalogCalendarService) {}

  @Get()
  @ApiOperation({
    summary: 'Release calendar for shows and movies',
    description:
      'Returns episodes and movie releases within the date range, grouped by day. Days without releases are omitted. The non-personalized calendar lists the 5 most popular movies per day.',
  })
  @ApiOkResponse({ type: CatalogCalendarResponseDto })
  @ApiBadRequestResponse({
    description: `Invalid query parameters (days must be <= ${CATALOG_MAX_CALENDAR_DAYS}; personalized and premieres must be 'true' or 'false'; type must be 'show' or 'movie')`,
  })
  @ApiUnauthorizedResponse({ description: 'Authentication required for personalized calendar' })
  async getCalendar(
    @Query() query: CatalogCalendarQueryDto,
    @CurrentUser() user?: { id: string } | null,
  ): Promise<CatalogCalendarResponseDto> {
    const personalized = query.personalized === 'true';
    if (personalized && !user) {
      throw new AppException(
        ErrorCode.UNAUTHORIZED,
        'Authentication required for personalized calendar',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const { from, toExclusive, ...calendar } = await this.calendarService.getCalendar({
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      days: query.days,
      viewerId: user?.id,
      personalized,
      premieresOnly: query.premieres === 'true',
      type: query.type,
    });

    return {
      ...calendar,
      startDate: from.toISOString(),
      endDate: toExclusive.toISOString(),
    };
  }
}
