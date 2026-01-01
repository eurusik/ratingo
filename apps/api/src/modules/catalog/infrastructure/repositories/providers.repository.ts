/**
 * Providers Repository
 *
 * Thin facade delegating to ProvidersQuery.
 */

import { Injectable, Logger } from '@nestjs/common';

import { DatabaseException } from '../../../../common/exceptions';
import {
  type IProvidersRepository,
  type ProviderInfo,
} from '../../domain/repositories/providers.repository.interface';
import { ProvidersQuery } from '../queries/providers.query';

@Injectable()
export class DrizzleProvidersRepository implements IProvidersRepository {
  private readonly logger = new Logger(DrizzleProvidersRepository.name);

  constructor(private readonly providersQuery: ProvidersQuery) {}

  /**
   * Gets unique streaming providers from catalog.
   *
   * @returns {Promise<ProviderInfo[]>} Providers sorted by media count desc
   * @throws {DatabaseException} On query failure
   */
  async findAllProviders(): Promise<ProviderInfo[]> {
    try {
      return await this.providersQuery.execute();
    } catch (error) {
      this.logger.error('Failed to extract providers from media items', error);
      throw new DatabaseException('Failed to extract providers', error);
    }
  }
}
