import { Inject, Injectable, Logger } from '@nestjs/common';

import { RunTrigger } from '@ratingo/ai-core';

import { formatPullRequest } from '../../domain/entities/pull-request';
import { ReviewJobSource, type ReviewJob } from '../../domain/entities/review-job';
import { ReviewStatus } from '../../domain/entities/review-outcome';
import { buildCheckReport } from '../../domain/policies/check-report';
import { decidePublishBlock } from '../../domain/policies/publish-guard';
import {
  CHECK_RUN_PUBLISHER_PORT,
  type CheckRunPublisherPort,
} from '../../domain/ports/check-run-publisher.port';
import { CODE_HOST_PORT, type CodeHostPort } from '../../domain/ports/code-host.port';

import { ReviewService } from './review.service';

export const ReviewJobResult = {
  PUBLISHED: 'published',
  SKIPPED_SILENTLY: 'skipped_silently',
  NOT_PUBLISHED: 'not_published',
} as const;
export type ReviewJobResult = (typeof ReviewJobResult)[keyof typeof ReviewJobResult];

@Injectable()
export class ReviewJobService {
  private readonly logger = new Logger(ReviewJobService.name);

  constructor(
    private readonly reviews: ReviewService,
    @Inject(CODE_HOST_PORT) private readonly host: CodeHostPort,
    @Inject(CHECK_RUN_PUBLISHER_PORT) private readonly publisher: CheckRunPublisherPort,
  ) {}

  async process(job: ReviewJob): Promise<ReviewJobResult> {
    const explicitRequest = job.source !== ReviewJobSource.PULL_REQUEST;
    const outcome = await this.reviews.review(
      job.ref,
      job.source === ReviewJobSource.INTERNAL_REQUEST ? RunTrigger.CHAT : RunTrigger.WEBHOOK,
      { explicitRequest },
    );
    if (outcome.status === ReviewStatus.SKIPPED && !explicitRequest) {
      this.logger.log(`${formatPullRequest(job.ref)} skipped: ${outcome.reason}`);
      return ReviewJobResult.SKIPPED_SILENTLY;
    }
    const current = await this.host.getPullRequest(job.ref);
    const blocked = decidePublishBlock(current, outcome.headSha);
    if (blocked !== null) {
      this.logger.log(`${formatPullRequest(job.ref)} not published: ${blocked}`);
      return ReviewJobResult.NOT_PUBLISHED;
    }
    await this.publisher.publish(job.ref, outcome.headSha, buildCheckReport(outcome));
    return ReviewJobResult.PUBLISHED;
  }
}
