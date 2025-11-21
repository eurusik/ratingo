/**
 * Процесор трендів - головна точка входу для обробки трендових шоу
 * @deprecated Використовуйте @/lib/sync/trendingProcessor замість цього
 */

export { runTrendingProcessor, DEFAULT_CONFIG } from '@/lib/sync/trendingProcessor/processor';

export type {
  TrendingProcessorConfig,
  TrendingProcessorResult,
} from '@/lib/sync/trendingProcessor/types';
