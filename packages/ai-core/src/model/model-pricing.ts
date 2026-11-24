import type { ModelRef } from './model-ref';
import { formatModelRef } from './model-ref';
import type { ModelUsage } from './model.types';

export interface ModelPrice {
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  cacheReadPerMTokUsd: number;
  cacheWritePerMTokUsd: number;
  reasoningPerMTokUsd: number;
}

export type PriceTable = Readonly<Record<string, ModelPrice>>;

const TOKENS_PER_MILLION = 1_000_000;

export class MissingModelPriceError extends Error {
  constructor(ref: string) {
    super(`No price configured for model "${ref}"`);
    this.name = 'MissingModelPriceError';
  }
}

export function priceFor(prices: PriceTable, ref: ModelRef | string): ModelPrice {
  const key = typeof ref === 'string' ? ref : formatModelRef(ref);
  const price = prices[key];
  if (price === undefined) {
    throw new MissingModelPriceError(key);
  }
  return price;
}

export function calculateCostUsd(usage: ModelUsage, price: ModelPrice): number {
  return (
    (usage.inputTokens * price.inputPerMTokUsd +
      usage.outputTokens * price.outputPerMTokUsd +
      usage.cacheReadTokens * price.cacheReadPerMTokUsd +
      usage.cacheWriteTokens * price.cacheWritePerMTokUsd +
      usage.reasoningTokens * price.reasoningPerMTokUsd) /
    TOKENS_PER_MILLION
  );
}

export function worstCaseCostUsd(
  inputTokens: number,
  maxOutputTokens: number,
  price: ModelPrice,
): number {
  const outputRate = Math.max(price.outputPerMTokUsd, price.reasoningPerMTokUsd);
  const inputRate = Math.max(
    price.inputPerMTokUsd,
    price.cacheReadPerMTokUsd,
    price.cacheWritePerMTokUsd,
  );
  return (inputTokens * inputRate + maxOutputTokens * outputRate) / TOKENS_PER_MILLION;
}
