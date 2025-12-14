import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { HomeService } from '../application/home.service';
import { HeroItemDto } from './dtos/hero-item.dto';
import { MediaType } from '../../../common/enums/media-type.enum';

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
   * @param {MediaType} type - Optional media type filter
   * @returns {Promise<HeroItemDto[]>} Hero items
   */
  @Get('hero')
  @ApiOperation({ summary: 'Get Hero block items (Top 3 hottest media)' })
  @ApiQuery({ name: 'type', required: false, enum: MediaType })
  @ApiResponse({ type: [HeroItemDto] })
  async getHero(@Query('type') type?: MediaType): Promise<HeroItemDto[]> {
    return this.homeService.getHero(type);
  }
}
