/**
 * Backfill Controller
 *
 * Admin endpoints for content classification backfill operations.
 */

import { Controller, Post, Query, Inject, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DATABASE_CONNECTION } from '../../../../database/database.module';
import { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '../../../../database/schema';
import {
  backfillContentClass,
  BackfillProgress,
} from '../../application/jobs/backfill-content-class.job';
import { PolicyActivationService } from '../../application/services/policy-activation.service';
import {
  CATALOG_POLICY_REPOSITORY,
  ICatalogPolicyRepository,
} from '../../infrastructure/repositories/catalog-policy.repository';

class BackfillResponseDto {
  success: boolean;
  message: string;
  progress?: BackfillProgress;
  reEvaluationRunId?: string;
}

@ApiTags('Admin - Content Classification')
@Controller('admin/catalog-policies/backfill')
export class BackfillController {
  private readonly logger = new Logger(BackfillController.name);

  constructor(
    @Inject(DATABASE_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(CATALOG_POLICY_REPOSITORY)
    private readonly policyRepository: ICatalogPolicyRepository,
    private readonly policyActivationService: PolicyActivationService,
  ) {}

  /**
   * Triggers content_class backfill for all media items.
   *
   * @param dryRunStr - If 'true', only simulates changes without updating DB
   * @param batchSizeStr - Batch size for processing (default: 1000)
   * @param triggerReEvaluationStr - If 'true', triggers catalog re-evaluation after backfill
   * @returns Backfill progress statistics
   */
  @Post('content-class')
  @ApiOperation({
    summary: 'Backfill content_class for all media items',
    description:
      'Classifies all existing media items based on genres and origin metadata. ' +
      'Use dry-run mode to preview changes without updating the database. ' +
      'Set triggerReEvaluation=true to automatically re-evaluate catalog after backfill.',
  })
  @ApiQuery({
    name: 'dryRun',
    description: 'If true, only simulates changes without updating DB',
    required: false,
    type: Boolean,
  })
  @ApiQuery({
    name: 'batchSize',
    description: 'Batch size for processing (default: 1000)',
    required: false,
    type: Number,
  })
  @ApiQuery({
    name: 'triggerReEvaluation',
    description: 'If true, triggers catalog re-evaluation after backfill completes',
    required: false,
    type: Boolean,
  })
  @ApiResponse({
    status: 201,
    description: 'Backfill completed',
    type: BackfillResponseDto,
  })
  async backfillContentClass(
    @Query('dryRun') dryRunStr?: string,
    @Query('batchSize') batchSizeStr?: string,
    @Query('triggerReEvaluation') triggerReEvaluationStr?: string,
  ): Promise<BackfillResponseDto> {
    const dryRun = dryRunStr === 'true';
    const batchSize = batchSizeStr ? parseInt(batchSizeStr, 10) : 1000;
    const triggerReEvaluation = triggerReEvaluationStr === 'true';

    this.logger.log(
      `Starting content_class backfill (dryRun=${dryRun}, batchSize=${batchSize}, triggerReEvaluation=${triggerReEvaluation})`,
    );

    try {
      const progress = await backfillContentClass(this.db, this.logger, {
        dryRun,
        batchSize,
      });

      let reEvaluationRunId: string | undefined;

      // Trigger re-evaluation if requested and not dry run
      if (triggerReEvaluation && !dryRun && progress.updated > 0) {
        const activePolicy = await this.policyRepository.findActive();

        if (activePolicy) {
          this.logger.log(`Triggering re-evaluation for active policy v${activePolicy.version}`);
          try {
            const result = await this.policyActivationService.preparePolicy(activePolicy.id);
            reEvaluationRunId = result.runId;
            this.logger.log(`Re-evaluation run created: ${reEvaluationRunId}`);
          } catch (error) {
            this.logger.warn(`Failed to trigger re-evaluation: ${error.message}`);
          }
        } else {
          this.logger.warn('No active policy found, skipping re-evaluation');
        }
      }

      return {
        success: true,
        message: dryRun
          ? `Dry run complete: ${progress.processed} items analyzed, ${progress.updated} would be updated`
          : `Backfill complete: ${progress.processed} items processed, ${progress.updated} updated`,
        progress,
        reEvaluationRunId,
      };
    } catch (error) {
      this.logger.error('Backfill failed', error);
      return {
        success: false,
        message: `Backfill failed: ${error.message}`,
      };
    }
  }
}
