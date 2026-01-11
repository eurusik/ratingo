import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { type ConfigType } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';

import { CronJob } from 'cron';

import authConfig from '../../../../config/auth.config';
import {
  EXCHANGE_CODES_REPOSITORY,
  type IExchangeCodesRepository,
} from '../../domain/repositories/exchange-codes.repository.interface';

/**
 * Scheduled job for cleaning up expired OAuth exchange codes.
 * Runs daily (configurable) to delete expired and used codes.
 */
@Injectable()
export class CleanupExchangeCodesJob implements OnModuleInit {
  private readonly logger = new Logger(CleanupExchangeCodesJob.name);

  constructor(
    @Inject(EXCHANGE_CODES_REPOSITORY)
    private readonly exchangeCodesRepository: IExchangeCodesRepository,
    @Inject(authConfig.KEY)
    private readonly config: ConfigType<typeof authConfig>,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {}

  onModuleInit(): void {
    const cronPattern = this.config.exchangeCodeCleanupCron;

    const job = new CronJob(cronPattern, () => this.handleCleanup(), null, true, 'UTC');

    this.schedulerRegistry.addCronJob('cleanup-exchange-codes', job);
    this.logger.log(`Exchange codes cleanup scheduled: "${cronPattern}" (UTC)`);
  }

  async handleCleanup(): Promise<void> {
    this.logger.log('Starting exchange codes cleanup...');

    try {
      const deletedCount = await this.exchangeCodesRepository.cleanupExpired();

      if (deletedCount > 0) {
        this.logger.log(`Cleanup complete: deleted ${deletedCount} expired/used exchange codes`);
      } else {
        this.logger.debug('Cleanup complete: no expired/used exchange codes to delete');
      }
    } catch (error) {
      this.logger.error(
        `Exchange codes cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
