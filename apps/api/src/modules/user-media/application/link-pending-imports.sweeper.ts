import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type IClockPort } from '../../shared/clock';
import {
  IMPORT_PENDING_REPOSITORY,
  LINK_PENDING_IMPORTS_BATCH_SIZE,
} from '../domain/constants/import-pending.constants';
import { pendingLinkSweepCutoffMs } from '../domain/policies/pending-link-sweep.policy';
import { type IImportPendingRepository } from '../domain/repositories/import-pending.repository.interface';

import { LinkPendingImportsService } from './link-pending-imports.service';

@Injectable()
export class LinkPendingImportsSweeper {
  private readonly logger = new Logger(LinkPendingImportsSweeper.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
    private readonly linkPendingImports: LinkPendingImportsService,
  ) {}

  async execute(): Promise<number> {
    const cutoff = new Date(pendingLinkSweepCutoffMs(this.clock.now().getTime()));
    const stuck = await this.pendingRepo.findIngestingWithReadyMedia(
      cutoff,
      LINK_PENDING_IMPORTS_BATCH_SIZE,
    );
    if (stuck.length === 0) {
      return 0;
    }

    const linked = await this.linkPendingImports.linkItems(stuck);
    this.logger.log(
      `[sweep] linked ${linked}/${stuck.length} item(s) stuck in ingesting since before ${cutoff.toISOString()}`,
    );
    return linked;
  }
}
