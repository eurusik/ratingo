import { ANTHROPIC_DEFAULT_PRICES } from './anthropic.prices';

const CACHE_READ_RATIO = 0.1;
const CACHE_WRITE_RATIO = 1.25;

describe('ANTHROPIC_DEFAULT_PRICES', () => {
  it('prices the three models the agents use', () => {
    expect(Object.keys(ANTHROPIC_DEFAULT_PRICES).sort()).toEqual([
      'anthropic:claude-haiku-5-5',
      'anthropic:claude-opus-5-5',
      'anthropic:claude-sonnet-5-5',
    ]);
  });

  it.each(Object.entries(ANTHROPIC_DEFAULT_PRICES))(
    'derives cache rates from the input rate for %s',
    (_model, price) => {
      expect(price.cacheReadPerMTokUsd).toBeCloseTo(price.inputPerMTokUsd * CACHE_READ_RATIO);
      expect(price.cacheWritePerMTokUsd).toBeCloseTo(price.inputPerMTokUsd * CACHE_WRITE_RATIO);
      expect(price.reasoningPerMTokUsd).toBe(price.outputPerMTokUsd);
    },
  );

  it('keeps the cheaper tiers cheaper', () => {
    const input = (model: string) =>
      ANTHROPIC_DEFAULT_PRICES[`anthropic:${model}`]?.inputPerMTokUsd ?? 0;
    expect(input('claude-haiku-5-5')).toBeLessThan(input('claude-sonnet-5-5'));
    expect(input('claude-sonnet-5-5')).toBeLessThan(input('claude-opus-5-5'));
  });
});
