import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

import { MediaType } from '../../../common/enums/media-type.enum';
import { type HomeService } from '../application/home.service';

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
  async getHero(@Query('type') type?: MediaType): Promise<HeroItemDto[]> {
    const items = await this.homeService.getHero(type);
    return HeroItemMapper.toDtoList(items);
  }
}
