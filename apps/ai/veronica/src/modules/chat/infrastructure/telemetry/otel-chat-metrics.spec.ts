import { AI_METRIC_NAMES } from '@ratingo/ai-core';

import { ChatOutcome, ChatCommand } from '../../domain/constants/chat.constants';

import { OtelChatMetrics } from './otel-chat-metrics';

describe('OtelChatMetrics', () => {
  it('counts events with bounded outcome and command labels', () => {
    const add = jest.fn();
    const createCounter = jest.fn().mockReturnValue({ add });
    new OtelChatMetrics({ createCounter } as never).record({
      outcome: ChatOutcome.HANDLED,
      command: ChatCommand.STATUS,
    });
    expect(createCounter).toHaveBeenCalledWith(AI_METRIC_NAMES.CHAT_EVENTS);
    expect(add).toHaveBeenCalledWith(1, { outcome: 'handled', command: 'status' });
  });
});
