import { Inject, Injectable, Logger } from '@nestjs/common';

import { CLOCK_PORT, type IClockPort } from '../../shared/clock';
import {
  IMPORT_PENDING_REPOSITORY,
  LINK_PENDING_IMPORTS_BATCH_SIZE,
} from '../domain/constants/import-pending.constants';
import { pendingLinkSweepCutoffsMs } from '../domain/policies/pending-link-sweep.policy';
import {
  IMPORT_LINK_METRICS,
  type IImportLinkMetrics,
} from '../domain/ports/import-link-metrics.port';
import {
  type ILinkPendingImportsSweep,
  type LinkPendingImportsSweepResult,
} from '../domain/ports/link-pending-imports-sweep.port';
import { type IImportPendingRepository } from '../domain/repositories/import-pending.repository.interface';

import { LinkPendingImportsService } from './link-pending-imports.service';

@Injectable()
export class LinkPendingImportsSweeper implements ILinkPendingImportsSweep {
  private readonly logger = new Logger(LinkPendingImportsSweeper.name);

  constructor(
    @Inject(IMPORT_PENDING_REPOSITORY)
    private readonly pendingRepo: IImportPendingRepository,
    @Inject(CLOCK_PORT)
    private readonly clock: IClockPort,
    private readonly linkPendingImports: LinkPendingImportsService,
    @Inject(IMPORT_LINK_METRICS)
    private readonly metrics: IImportLinkMetrics,
  ) {}

  async execute(): Promise<LinkPendingImportsSweepResult> {
    const cutoffs = pendingLinkSweepCutoffsMs(this.clock.now().getTime());
    const linked = await this.linkStuckItems(
      new Date(cutoffs.ingestingBefore),
      new Date(cutoffs.staleLinkingBefore),
    );
    const timedOut = await this.linkPendingImports.failTimedOutIngests(
      new Date(cutoffs.ingestTimeoutBefore),
      LINK_PENDING_IMPORTS_BATCH_SIZE,
    );
    const result = { linked, timedOut };
    this.metrics.recordSweep(result);
    return result;
  }

  private async linkStuckItems(ingestingBefore: Date, staleLinkingBefore: Date): Promise<number> {
    const stuck = await this.pendingRepo.findLinkableWithReadyMedia({
      ingestingBefore,
      staleLinkingBefore,
      limit: LINK_PENDING_IMPORTS_BATCH_SIZE,
    });
    if (stuck.length === 0) {
      return 0;
    }

    const linked = await this.linkPendingImports.linkItems(stuck);
    this.logger.log(
      `[sweep] linked ${linked}/${stuck.length} stuck item(s) (ingesting since before ${ingestingBefore.toISOString()})`,
    );
    return linked;
  }
}
