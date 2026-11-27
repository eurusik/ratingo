import type { ModelAliases, ModelPrice, PriceTable } from '@ratingo/ai-core';
import { ANTHROPIC_DEFAULT_PRICES } from '@ratingo/ai-core';

export const MODEL_ALIAS_NAMES = ['review'] as const;

export const STUB_PROVIDER = 'stub';
const STUB_REVIEW_MODEL = 'review';

const FREE_PRICE: ModelPrice = {
  inputPerMTokUsd: 0,
  outputPerMTokUsd: 0,
  cacheReadPerMTokUsd: 0,
  cacheWritePerMTokUsd: 0,
  reasoningPerMTokUsd: 0,
};

export const MODEL_PRICES: PriceTable = {
  ...ANTHROPIC_DEFAULT_PRICES,
  [`${STUB_PROVIDER}:${STUB_REVIEW_MODEL}`]: FREE_PRICE,
};

export const buildModelAliases = (env: { AI_MODEL_REVIEW: string }): ModelAliases => ({
  review: [env.AI_MODEL_REVIEW],
});
