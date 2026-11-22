import { formatModelRef } from '../../model-ref';
import type { ModelPrice, PriceTable } from '../../model-pricing';
import { ANTHROPIC_PROVIDER } from './anthropic.mapper';

const CACHE_WRITE_MULTIPLIER = 1.25;
const CACHE_READ_MULTIPLIER = 0.1;

function anthropicPrice(inputPerMTokUsd: number, outputPerMTokUsd: number): ModelPrice {
  return {
    inputPerMTokUsd,
    outputPerMTokUsd,
    cacheReadPerMTokUsd: inputPerMTokUsd * CACHE_READ_MULTIPLIER,
    cacheWritePerMTokUsd: inputPerMTokUsd * CACHE_WRITE_MULTIPLIER,
    reasoningPerMTokUsd: outputPerMTokUsd,
  };
}

function priceEntry(model: string, price: ModelPrice): [string, ModelPrice] {
  return [formatModelRef({ provider: ANTHROPIC_PROVIDER, model }), price];
}

export const ANTHROPIC_DEFAULT_PRICES: PriceTable = Object.fromEntries([
  priceEntry('claude-haiku-5-5', anthropicPrice(0.1, 0.5)),
  priceEntry('claude-sonnet-5-5', anthropicPrice(2, 10)),
  priceEntry('claude-opus-5-5', anthropicPrice(4, 20)),
]);
