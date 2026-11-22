import * as fc from 'fast-check';

import { ChatOutcome } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';

import { exchangeOutcomeOf } from './exchange-outcome.policy';

describe('exchangeOutcomeOf', () => {
  it.each([
    [ChatOutcome.HANDLED, ExchangeOutcome.ANSWERED],
    [ChatOutcome.ANSWERED, ExchangeOutcome.ANSWERED],
    [ChatOutcome.REDACTED, ExchangeOutcome.REDACTED],
    [ChatOutcome.FALLBACK, ExchangeOutcome.FALLBACK],
    [ChatOutcome.FAILED, ExchangeOutcome.FAILED],
    [ChatOutcome.IGNORED, null],
    [ChatOutcome.REJECTED, null],
  ])('maps %s to %s', (outcome, expected) => {
    expect(exchangeOutcomeOf(outcome)).toBe(expected);
  });

  it('only ever yields a stored outcome or nothing', () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.values(ChatOutcome)), (outcome) => {
        const mapped = exchangeOutcomeOf(outcome);
        expect(mapped === null || Object.values(ExchangeOutcome).includes(mapped)).toBe(true);
      }),
    );
  });
});
