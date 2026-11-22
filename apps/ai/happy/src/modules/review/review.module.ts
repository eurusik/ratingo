import { Module } from '@nestjs/common';

import { CLOCK_PORT, type ClockPort } from '@ratingo/ai-core';

import {
  GITHUB_CONFIG,
  type GithubAuthConfig,
  type GithubConfig,
} from '../../config/config.constants';

import { DeepReviewService } from './application/services/deep-review.service';
import { ReviewJobService } from './application/services/review-job.service';
import { ReviewService } from './application/services/review.service';
import { TriageService } from './application/services/triage.service';
import { CHECK_RUN_PUBLISHER_PORT } from './domain/ports/check-run-publisher.port';
import { CODE_HOST_PORT } from './domain/ports/code-host.port';
import { GithubCodeHostAdapter } from './infrastructure/adapters/github.code-host-adapter';
import { GithubAppTokenProvider } from './infrastructure/auth/github-app-token.provider';
import {
  StaticTokenProvider,
  type GithubTokenProvider,
} from './infrastructure/auth/github-token.provider';
import { InternalReviewController } from './presentation/controllers/internal-review.controller';
import { ServiceTokenGuard } from './presentation/guards/service-token.guard';

const tokenProviderFor = (
  auth: GithubAuthConfig,
  apiUrl: string,
  clock: ClockPort,
): GithubTokenProvider =>
  auth.kind === 'app'
    ? new GithubAppTokenProvider({
        appId: auth.appId,
        privateKey: auth.privateKey,
        apiUrl,
        nowMs: () => clock.nowMs(),
      })
    : new StaticTokenProvider(auth.token);

@Module({
  controllers: [InternalReviewController],
  providers: [
    ReviewService,
    ReviewJobService,
    TriageService,
    DeepReviewService,
    ServiceTokenGuard,
    {
      provide: CODE_HOST_PORT,
      inject: [GITHUB_CONFIG, CLOCK_PORT],
      useFactory: (github: GithubConfig, clock: ClockPort) =>
        new GithubCodeHostAdapter({
          tokens: tokenProviderFor(github.auth, github.apiUrl, clock),
          apiUrl: github.apiUrl,
        }),
    },
    { provide: CHECK_RUN_PUBLISHER_PORT, useExisting: CODE_HOST_PORT },
  ],
  exports: [ReviewService, ReviewJobService],
})
export class ReviewModule {}
