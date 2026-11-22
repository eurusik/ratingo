import { Inject, Injectable } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort, type RunTrigger } from '@ratingo/ai-core';

import { DIGEST_THRESHOLDS } from '../../../../config/digest.config';
import type { DigestBlock } from '../../domain/constants/digest-block.constants';
import type { Digest, RenderedMessage } from '../../domain/entities/digest';
import {
  DIGEST_RENDERER_PORT,
  type DigestRendererPort,
} from '../../domain/ports/digest-renderer.port';
import { evaluateDigest } from '../../domain/rules/evaluate-digest';

import { DigestTextService } from './digest-text.service';
import { SnapshotService } from './snapshot.service';

export interface ComposedDigest {
  digest: Digest;
  message: RenderedMessage;
  runId: string | null;
}

@Injectable()
export class DigestComposeService {
  constructor(
    private readonly snapshots: SnapshotService,
    private readonly texts: DigestTextService,
    @Inject(DIGEST_RENDERER_PORT) private readonly renderer: DigestRendererPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async evaluate(): Promise<Digest> {
    const snapshot = await this.snapshots.take(this.clock.nowMs());
    return evaluateDigest(snapshot, DIGEST_THRESHOLDS);
  }

  async status(): Promise<RenderedMessage> {
    return this.renderer.renderStatus(await this.evaluate());
  }

  async blocks(blocks: readonly DigestBlock[]): Promise<RenderedMessage> {
    return this.renderer.renderBlocks(await this.evaluate(), blocks);
  }

  async compose(trigger: RunTrigger): Promise<ComposedDigest> {
    const digest = await this.evaluate();
    const written = await this.texts.write(digest, trigger);
    return {
      digest,
      runId: written.runId,
      message: this.renderer.render({ digest, text: written.text, modelCostUsd: written.costUsd }),
    };
  }
}
