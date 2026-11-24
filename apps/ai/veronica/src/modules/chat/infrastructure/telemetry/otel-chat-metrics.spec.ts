import { AI_METRIC_NAMES } from '@ratingo/ai-core';

import { ChatCommand, ChatOutcome, ChatRoute } from '../../domain/constants/chat.constants';

import { OtelChatMetrics } from './otel-chat-metrics';

describe('OtelChatMetrics', () => {
  it('counts events with bounded outcome, command and route labels', () => {
    const add = jest.fn();
    const createCounter = jest.fn().mockReturnValue({ add });
    new OtelChatMetrics({ createCounter } as never).record({
      outcome: ChatOutcome.HANDLED,
      command: ChatCommand.STATUS,
      route: ChatRoute.COMMAND,
    });
    expect(createCounter).toHaveBeenCalledWith(AI_METRIC_NAMES.CHAT_EVENTS);
    expect(add).toHaveBeenCalledWith(1, {
      outcome: 'handled',
      command: 'status',
      route: 'command',
    });
  });
});
