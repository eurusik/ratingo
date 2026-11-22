import { ChatOutcome } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';

export const exchangeOutcomeOf = (outcome: ChatOutcome): ExchangeOutcome | null => {
  switch (outcome) {
    case ChatOutcome.HANDLED:
    case ChatOutcome.ANSWERED:
      return ExchangeOutcome.ANSWERED;
    case ChatOutcome.REDACTED:
      return ExchangeOutcome.REDACTED;
    case ChatOutcome.FALLBACK:
      return ExchangeOutcome.FALLBACK;
    case ChatOutcome.FAILED:
      return ExchangeOutcome.FAILED;
    case ChatOutcome.IGNORED:
    case ChatOutcome.REJECTED:
      return null;
  }
};
