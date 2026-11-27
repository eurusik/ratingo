import { ModelError } from '../../model.errors';
import type { ModelRequest } from '../../model.types';
import {
  ContentPartType,
  MessageRole,
  StopReason,
  ToolChoice,
  textMessage,
} from '../../model.types';
import { StubModelAdapter } from './stub.model-adapter';
import { EXPENSIVE_STUB_USAGE, StubScenario, createStubScript } from './stub.scenarios';

const request: ModelRequest = {
  model: 'test-model',
  system: '',
  messages: [textMessage(MessageRole.USER, 'hi')],
  tools: [],
  maxTokens: 100,
  timeoutMs: 1000,
};

describe('StubModelAdapter', () => {
  it('walks the normal scenario: one tool call, then the final text', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.NORMAL));

    const first = await stub.generate(request);
    const second = await stub.generate(request);

    expect(first.stopReason).toBe(StopReason.TOOL_USE);
    expect(second.stopReason).toBe(StopReason.END);
    expect(second.model).toBe('stub:test-model');
  });

  it('never stops calling tools in the runaway scenario', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.RUNAWAY));

    const callCount = 4;
    const responses = await Promise.all(
      Array.from({ length: callCount }, () => stub.generate(request)),
    );

    expect(responses.every((response) => response.stopReason === StopReason.TOOL_USE)).toBe(true);
    const ids = responses.flatMap((response) =>
      response.content.flatMap((part) =>
        part.type === ContentPartType.TOOL_CALL ? [part.call.id] : [],
      ),
    );
    expect(new Set(ids).size).toBe(callCount);
  });

  it('refuses in the refusal scenario', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.REFUSAL));

    await expect(stub.generate(request)).resolves.toMatchObject({ stopReason: StopReason.REFUSAL });
  });

  it('reports huge usage in the budget scenario', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.BUDGET_EXCEEDED));

    const response = await stub.generate(request);

    expect(response.usage.inputTokens).toBe(EXPENSIVE_STUB_USAGE.inputTokens);
  });

  it('rejects with a ModelError in the transport-failure scenario', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.TRANSPORT_FAILURE));

    await expect(stub.generate(request)).rejects.toBeInstanceOf(ModelError);
  });

  it('records every request it receives', async () => {
    const stub = new StubModelAdapter(createStubScript(StubScenario.NORMAL));

    await stub.generate(request);

    expect(stub.requests).toHaveLength(1);
  });
});

describe('StubModelAdapter with tool use forbidden', () => {
  it('answers with the final text instead of a tool call', async () => {
    const adapter = new StubModelAdapter(
      createStubScript(StubScenario.RUNAWAY, { finalText: 'done' }),
    );
    const response = await adapter.generate({ ...request, toolChoice: ToolChoice.NONE });

    expect(response.stopReason).toBe(StopReason.END);
    expect(response.content).toEqual([{ type: ContentPartType.TEXT, text: 'done' }]);
  });
});
