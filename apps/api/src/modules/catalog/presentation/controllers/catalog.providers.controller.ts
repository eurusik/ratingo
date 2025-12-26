/**
 * Catalog Providers Controller
 *
 * Public endpoint for streaming providers available in the catalog.
 */

import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  PROVIDERS_REPOSITORY,
  IProvidersRepository,
} from '../../infrastructure/repositories/providers.repository';
import { ProvidersListDto } from '../dtos/providers.dto';

@ApiTags('Public: Catalog')
@Controller('catalog/providers')
export class CatalogProvidersController {
  constructor(
    @Inject(PROVIDERS_REPOSITORY)
    private readonly providersRepository: IProvidersRepository,
  ) {}

  /**
   * Gets streaming providers available in catalog.
   *
   * @returns {Promise<ProvidersListDto>} Providers sorted by media count
   */
  @Get()
  @ApiOperation({
    summary: 'Get streaming providers',
    description:
      'Returns streaming providers (Netflix, Max, etc.) sorted by available titles count.',
  })
  @ApiOkResponse({ type: ProvidersListDto })
  async getProviders(): Promise<ProvidersListDto> {
    const providers = await this.providersRepository.findAllProviders();
    return { data: providers };
  }
}
