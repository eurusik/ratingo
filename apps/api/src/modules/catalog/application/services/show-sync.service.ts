import { Inject, Injectable, Logger } from '@nestjs/common';

import { MediaType } from '../../../../common/enums/media-type.enum';
import { CLOCK_PORT, type IClockPort } from '../../../shared/clock';
import { ShowNotFoundError } from '../../domain/errors';
import { COOLDOWN_GATE_PORT, type ICooldownGate } from '../../domain/ports/cooldown-gate.port';
import { type IImportJobPort, IMPORT_JOB_PORT } from '../../domain/ports/import-job.port';
import {
  SHOW_REPOSITORY,
  type IShowRepository,
} from '../../domain/repositories/show.repository.interface';

export interface SyncRequestResult {
  queued: boolean;
  lastSyncedAt: Date | null;
  cooldownExpiresAt: Date | null;
}

const SHOW_SYNC_COOLDOWN_SECONDS = 7 * 24 * 3600;

/**
 * Handles user-triggered metadata sync requests with a 7-day per-show cooldown.
 * Uses an atomic cooldown gate (Redis NX+TTL via Lua); queues via existing IMPORT_JOB_PORT.
 */
@Injectable()
export class ShowSyncService {
  private readonly logger = new Logger(ShowSyncService.name);

  constructor(
    @Inject(SHOW_REPOSITORY)
    private readonly showRepository: IShowRepository,
    @Inject(IMPORT_JOB_PORT)
    private readonly importJobPort: IImportJobPort,
    @Inject(COOLDOWN_GATE_PORT)
    private readonly cooldownGate: ICooldownGate,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
  ) {}

  async requestSync(slug: string): Promise<SyncRequestResult> {
    const show = await this.showRepository.findIdentityBySlug(slug);
    if (!show) throw new ShowNotFoundError(slug);

    const cooldownKey = `sync:cooldown:v1:show:${show.id}`;

    const result = await this.cooldownGate.tryAcquire(cooldownKey, SHOW_SYNC_COOLDOWN_SECONDS);

    if (result.acquired === false) {
      const now = this.clock.now();
      return {
        queued: false,
        lastSyncedAt: show.lastSyncedAt,
        cooldownExpiresAt: new Date(now.getTime() + result.expiresInSeconds * 1000),
      };
    }

    try {
      await this.importJobPort.queueImport(show.tmdbId, MediaType.SHOW);
      this.logger.log(`Sync queued for show ${slug} (tmdbId: ${show.tmdbId})`);
    } catch (error) {
      // Release the cooldown lock so a transient queue failure doesn't block the user for 7 days.
      await this.cooldownGate.release(cooldownKey);
      this.logger.warn(`Failed to queue sync for show ${slug}: ${error.message}`);
      throw error;
    }

    return {
      queued: true,
      lastSyncedAt: show.lastSyncedAt,
      cooldownExpiresAt: null,
    };
  }
}
