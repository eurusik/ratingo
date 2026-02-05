import { Module } from '@nestjs/common';

import { MovieVerdictService } from './application/movie-verdict.service';
import { ShowVerdictService } from './application/show-verdict.service';

/**
 * Verdict Engine Module
 *
 * Provides verdict computation services for movies and shows.
 * Domain logic for evaluating media quality and generating user-facing recommendations.
 *
 * DNA Ratingo: "honesty before hype"
 */
@Module({
  providers: [MovieVerdictService, ShowVerdictService],
  exports: [MovieVerdictService, ShowVerdictService],
})
export class VerdictModule {}
