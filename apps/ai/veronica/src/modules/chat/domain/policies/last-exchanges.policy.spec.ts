import { ChatRoute } from '../constants/chat.constants';
import { ExchangeOutcome } from '../constants/exchange.constants';
import type { ChatExchange } from '../entities/chat-exchange';

import { renderLastExchanges } from './last-exchanges.policy';

const exchange = (overrides: Partial<ChatExchange>): ChatExchange => ({
  id: 'id',
  runId: 'run',
  chatId: '10',
  createdAtMs: 0,
  route: ChatRoute.INVESTIGATION,
  question: 'питання',
  answer: 'відповідь',
  outcome: ExchangeOutcome.ANSWERED,
  cutNumbers: [],
  toolNames: [],
  costUsd: 0.0049,
  ...overrides,
});

describe('renderLastExchanges', () => {
  it('says so when nothing was recorded', () => {
    expect(renderLastExchanges([])).toContain('Ще немає');
  });

  it('shows the question, the outcome and the cost on one line each', () => {
    const html = renderLastExchanges([
      exchange({ question: 'Що з чергами?' }),
      exchange({ outcome: ExchangeOutcome.REDACTED, costUsd: 0 }),
    ]);
    expect(html).toContain('• «Що з чергами?» → відповіла, $0.005');
    expect(html).toContain('→ прибрала цифри без підтвердження, $0.000');
  });

  it('escapes markup and shortens long questions', () => {
    const html = renderLastExchanges([exchange({ question: `<b>${'я'.repeat(200)}` })]);
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('…');
    expect(html).not.toContain('<b>я');
  });
});
