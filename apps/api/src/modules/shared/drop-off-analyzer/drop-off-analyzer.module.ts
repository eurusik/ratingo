import { Module } from '@nestjs/common';
import { DropOffAnalyzerService } from './drop-off-analyzer.service';

/**
 * Module for drop-off analysis functionality.
 * Analyzes show episode data to detect viewer drop-off points.
 */
@Module({
  providers: [DropOffAnalyzerService],
  exports: [DropOffAnalyzerService],
})
export class DropOffAnalyzerModule {}
