import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  QUEUE_KEY_REPAIR_PORT,
  RepairOutcome,
  type QueueKeyRepairPort,
} from '../../domain/ports/watchdog.ports';
import { LEGACY_ACTIVE_JOBS_LIST_KEY } from '../../watchdog.constants';

@Injectable()
export class WatchdogQueueRepair {
  private readonly logger = new Logger(WatchdogQueueRepair.name);
  private pending?: Promise<void>;

  constructor(@Inject(QUEUE_KEY_REPAIR_PORT) private readonly repair: QueueKeyRepairPort) {}

  ensure(): Promise<void> {
    this.pending ??= this.run();
    return this.pending;
  }

  private async run(): Promise<void> {
    try {
      const { outcome, foundType } = await this.repair.repairActiveJobsList();
      if (outcome === RepairOutcome.REPAIRED) {
        this.logger.warn(
          `Ключ ${LEGACY_ACTIVE_JOBS_LIST_KEY} мав тип ${foundType} замість list: видалено, щоб черга сторожа знову запрацювала`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Ключ ${LEGACY_ACTIVE_JOBS_LIST_KEY} не перевірено: ${error instanceof Error ? error.name : 'error'}`,
      );
    }
  }
}
