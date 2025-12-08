import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScoreCalculatorService } from './score-calculator.service';
import scoreConfig from '@/config/score.config';

/**
 * Shared module for Ratingo Score calculation.
 * Can be imported by Ingestion and Stats modules.
 */
@Module({
  imports: [ConfigModule.forFeature(scoreConfig)],
  providers: [ScoreCalculatorService],
  exports: [ScoreCalculatorService],
})
export class ScoreCalculatorModule {}
