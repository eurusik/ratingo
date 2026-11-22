import {
  ContentPartType,
  MessageRole,
  StopReason,
  type ModelRequest,
  type ToolDefinition,
} from '@ratingo/ai-core';

import { createStubScript } from './stub.script';

const tool = (name: string, required: string[] = []): ToolDefinition => ({
  name,
  description: name,
  inputSchema: { type: 'object', properties: {}, required },
});

const request = (overrides: Partial<ModelRequest>): ModelRequest => ({
  model: 'digest',
  system: '',
  messages: [{ role: MessageRole.USER, content: [{ type: ContentPartType.TEXT, text: 'q' }] }],
  tools: [],
  maxTokens: 100,
  timeoutMs: 1000,
  ...overrides,
});

describe('stub script', () => {
  it('keeps writing the digest when no tools are offered', () => {
    const response = createStubScript().respond(request({}), 0);
    expect(response.stopReason).toBe(StopReason.END);
    expect(JSON.stringify(response.content)).toContain('headline');
  });

  it('calls a tool that needs no input first, then answers once it has a result', () => {
    const script = createStubScript();
    const tools = [tool('metrics_query', ['template']), tool('digest_snapshot')];
    const first = script.respond(request({ tools }), 0);
    expect(first.stopReason).toBe(StopReason.TOOL_USE);
    expect(JSON.stringify(first.content)).toContain('digest_snapshot');
    const second = script.respond(
      request({
        tools,
        messages: [
          { role: MessageRole.USER, content: [{ type: ContentPartType.TEXT, text: 'q' }] },
          {
            role: MessageRole.USER,
            content: [
              {
                type: ContentPartType.TOOL_RESULT,
                result: { callId: 'stub-call', content: '{}', isError: false },
              },
            ],
          },
        ],
      }),
      1,
    );
    expect(second.stopReason).toBe(StopReason.END);
    expect(JSON.stringify(second.content)).toContain('заглушки');
  });
});
