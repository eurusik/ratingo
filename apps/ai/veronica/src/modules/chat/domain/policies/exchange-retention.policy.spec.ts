import * as fc from 'fast-check';

import { EXCHANGE_RETENTION_MS } from '../constants/exchange.constants';

import { exchangeRetentionCutoffMs } from './exchange-retention.policy';

const instant = fc.integer({ min: 0, max: 4_000_000_000_000 });

describe('exchange retention', () => {
  it('keeps thirty days', () => {
    expect(EXCHANGE_RETENTION_MS).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('puts the cutoff exactly one retention window before now', () => {
    fc.assert(
      fc.property(instant, (nowMs) => {
        expect(nowMs - exchangeRetentionCutoffMs(nowMs)).toBe(EXCHANGE_RETENTION_MS);
      }),
    );
  });

  it('is idempotent: a later purge never reaches newer rows than an earlier one', () => {
    fc.assert(
      fc.property(instant, fc.integer({ min: 0, max: 1_000_000_000 }), (nowMs, delta) => {
        expect(exchangeRetentionCutoffMs(nowMs + delta)).toBeGreaterThanOrEqual(
          exchangeRetentionCutoffMs(nowMs),
        );
      }),
    );
  });
});
