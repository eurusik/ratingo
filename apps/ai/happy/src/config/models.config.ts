import type { ModelAliases, ModelPrice, PriceTable } from '@ratingo/ai-core';
import { ANTHROPIC_DEFAULT_PRICES } from '@ratingo/ai-core';

export const MODEL_ALIAS_NAMES = ['fast', 'review', 'smart'] as const;

const FREE_PRICE: ModelPrice = {
  inputPerMTokUsd: 0,
  outputPerMTokUsd: 0,
  cacheReadPerMTokUsd: 0,
  cacheWritePerMTokUsd: 0,
  reasoningPerMTokUsd: 0,
};

export const STUB_PROVIDER = 'stub';
export const STUB_TRIAGE_MODEL = 'triage';
export const STUB_REVIEW_MODEL = 'review';

export const MODEL_PRICES: PriceTable = {
  ...ANTHROPIC_DEFAULT_PRICES,
  [`${STUB_PROVIDER}:${STUB_TRIAGE_MODEL}`]: FREE_PRICE,
  [`${STUB_PROVIDER}:${STUB_REVIEW_MODEL}`]: FREE_PRICE,
};

export const buildModelAliases = (env: {
  AI_MODEL_FAST: string;
  AI_MODEL_REVIEW: string;
}): ModelAliases => ({
  fast: [env.AI_MODEL_FAST],
  review: [env.AI_MODEL_REVIEW],
});
