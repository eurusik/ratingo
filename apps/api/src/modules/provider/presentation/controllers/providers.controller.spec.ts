import { BadRequestException } from '@nestjs/common';

import { type ProviderMappingService } from '@/modules/provider/application/services/provider-mapping.service';
import { type ProviderRegistryService } from '@/modules/provider/application/services/provider-registry.service';
import { type UnmappedTrackingService } from '@/modules/provider/application/services/unmapped-tracking.service';

import { ProvidersController } from './providers.controller';

describe('ProvidersController', () => {
  let registryService: { findByIdOrNull: jest.Mock };
  let mappingService: { create: jest.Mock; update: jest.Mock };
  let controller: ProvidersController;

  beforeEach(() => {
    registryService = { findByIdOrNull: jest.fn().mockResolvedValue(null) };
    mappingService = { create: jest.fn(), update: jest.fn() };
    controller = new ProvidersController(
      registryService as unknown as ProviderRegistryService,
      mappingService as unknown as ProviderMappingService,
      { removeByTmdbId: jest.fn() } as unknown as UnmappedTrackingService,
    );
  });

  it('rejects creating a mapping to an unknown provider with 400', async () => {
    await expect(
      controller.createMapping({ tmdbProviderId: 8, providerId: 'unknown' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(registryService.findByIdOrNull).toHaveBeenCalledWith('unknown');
    expect(mappingService.create).not.toHaveBeenCalled();
  });

  it('rejects moving a mapping to an unknown provider with 400', async () => {
    await expect(
      controller.updateMapping('mapping-1', { providerId: 'unknown' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mappingService.update).not.toHaveBeenCalled();
  });
});
