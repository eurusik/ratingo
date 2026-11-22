import { Module } from '@nestjs/common';

import { GITHUB_CONFIG, type GithubConfig } from '../../config/config.constants';

import { DeepReviewService } from './application/services/deep-review.service';
import { ReviewService } from './application/services/review.service';
import { TriageService } from './application/services/triage.service';
import { CODE_HOST_PORT } from './domain/ports/code-host.port';
import { GithubCodeHostAdapter } from './infrastructure/adapters/github.code-host-adapter';
import { InternalReviewController } from './presentation/controllers/internal-review.controller';
import { ServiceTokenGuard } from './presentation/guards/service-token.guard';

@Module({
  controllers: [InternalReviewController],
  providers: [
    ReviewService,
    TriageService,
    DeepReviewService,
    ServiceTokenGuard,
    {
      provide: CODE_HOST_PORT,
      inject: [GITHUB_CONFIG],
      useFactory: (github: GithubConfig) =>
        new GithubCodeHostAdapter({ token: github.token ?? '', apiUrl: github.apiUrl }),
    },
  ],
  exports: [ReviewService],
})
export class ReviewModule {}
