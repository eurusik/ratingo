import { Controller, Get, ParseEnumPipe, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { MediaType } from '../../../common/enums/media-type.enum';
import { HomeService } from '../application/home.service';

import { HeroItemDto } from './dtos/hero-item.dto';
import { HeroItemMapper } from './mappers/hero-item.mapper';

/**
 * Public home endpoints.
 */
@ApiTags('Home')
@Controller('home')
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  /**
   * Gets hero block items.
   *
   * @param type - Optional media type filter
   * @returns Hero items for homepage
   */
  @Get('hero')
  @ApiOperation({ summary: 'Get Hero block items (Top 4 hottest media)' })
  @ApiQuery({ name: 'type', required: false, enum: MediaType })
  @ApiResponse({ type: [HeroItemDto] })
  async getHero(
    @Query('type', new ParseEnumPipe(MediaType, { optional: true })) type?: MediaType,
  ): Promise<HeroItemDto[]> {
    const items = await this.homeService.getHero(type);
    return HeroItemMapper.toDtoList(items);
  }

  /**
   * Gets "Watching Now" (Зараз дивляться) items.
   * Returns Top-3 FRESH content sorted by live watchers count.
   *
   * @returns Fresh, actively watched media items
   */
  @Get('watching-now')
  @ApiOperation({
    summary: 'Get "Watching Now" items (Top 3 fresh content by live watchers)',
    description:
      'Returns fresh content with most live Trakt watchers. ' +
      'Movies: released within 45 days. Shows: last episode within 21 days or has upcoming episode.',
  })
  @ApiResponse({ type: [HeroItemDto] })
  async getWatchingNow(): Promise<HeroItemDto[]> {
    const items = await this.homeService.getWatchingNow();
    return HeroItemMapper.toDtoList(items);
  }
}
