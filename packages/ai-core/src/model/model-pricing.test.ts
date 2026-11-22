import * as fc from 'fast-check';
import {
  MissingModelPriceError,
  calculateCostUsd,
  priceFor,
  worstCaseCostUsd,
} from './model-pricing';
import type { ModelPrice } from './model-pricing';

const PRICE: ModelPrice = {
  inputPerMTokUsd: 2,
  outputPerMTokUsd: 10,
  cacheReadPerMTokUsd: 0.2,
  cacheWritePerMTokUsd: 2.5,
  reasoningPerMTokUsd: 10,
};

const rate = fc.double({ min: 0, max: 100, noNaN: true });
const priceArbitrary = fc.record({
  inputPerMTokUsd: rate,
  outputPerMTokUsd: rate,
  cacheReadPerMTokUsd: rate,
  cacheWritePerMTokUsd: rate,
  reasoningPerMTokUsd: rate,
});

const tokens = fc.integer({ min: 0, max: 1_000_000 });
const usageArbitrary = fc.record({
  inputTokens: tokens,
  outputTokens: tokens,
  cacheReadTokens: tokens,
  cacheWriteTokens: tokens,
  reasoningTokens: tokens,
});
const FLOAT_TOLERANCE = 1e-9;

describe('model pricing', () => {
  it('prices every token kind at its own rate', () => {
    const cost = calculateCostUsd(
      {
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        cacheReadTokens: 1_000_000,
        cacheWriteTokens: 1_000_000,
        reasoningTokens: 1_000_000,
      },
      PRICE,
    );
    expect(cost).toBeCloseTo(2 + 10 + 0.2 + 2.5 + 10);
  });

  it('looks prices up by reference and fails closed when missing', () => {
    const prices = { 'stub:test-model': PRICE };
    expect(priceFor(prices, { provider: 'stub', model: 'test-model' })).toBe(PRICE);
    expect(priceFor(prices, 'stub:test-model')).toBe(PRICE);
    expect(() => priceFor(prices, 'stub:other')).toThrow(MissingModelPriceError);
  });

  it('never prices a real call above its worst case', () => {
    fc.assert(
      fc.property(priceArbitrary, usageArbitrary, (price, usage) => {
        const promptTokens = usage.inputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;
        const maxOutput = usage.outputTokens + usage.reasoningTokens;
        expect(calculateCostUsd(usage, price)).toBeLessThanOrEqual(
          worstCaseCostUsd(promptTokens, maxOutput, price) + FLOAT_TOLERANCE,
        );
      }),
    );
  });

  it('is additive over usage', () => {
    fc.assert(
      fc.property(priceArbitrary, tokens, tokens, (price, left, right) => {
        const usage = (inputTokens: number) => ({
          inputTokens,
          outputTokens: 0,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
          reasoningTokens: 0,
        });
        expect(calculateCostUsd(usage(left + right), price)).toBeCloseTo(
          calculateCostUsd(usage(left), price) + calculateCostUsd(usage(right), price),
          6,
        );
      }),
    );
  });
});
