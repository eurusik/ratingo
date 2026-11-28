import { z } from 'zod';
import { FixedClock } from '../clock/fixed.clock';
import { StubModelAdapter } from '../model/adapters/stub/stub.model-adapter';
import {
  DEFAULT_STUB_FINAL_TEXT,
  DEFAULT_STUB_USAGE,
  STUB_TRANSPORT_FAILURE_MESSAGE,
  StubScenario,
  TOOL_ERROR_FINAL_TEXT,
  createStubScript,
} from '../model/adapters/stub/stub.scenarios';
import type { StubScript } from '../model/adapters/stub/stub.scenarios';
import { ModelError, ModelErrorCategory } from '../model/model.errors';
import type { ModelPort } from '../model/model.port';
import type { ModelPrice } from '../model/model-pricing';
import { MissingModelPriceError } from '../model/model-pricing';
import { formatModelRef } from '../model/model-ref';
import type { ModelRequest, ModelResponse } from '../model/model.types';
import { ContentPartType, MessageRole, StopReason, ToolChoice } from '../model/model.types';
import { InMemoryRunRepository } from '../runs/in-memory.run-repository';
import { Run, RunStatus, RunStopReason, RunTrigger } from '../runs/run';
import { defineTool } from '../tools/define-tool';
import type { Tool } from '../tools/define-tool';
import { NativeToolSource } from '../tools/sources/native.tool-source';
import { ToolRegistry } from '../tools/tool-registry';
import { AgentLoop, EmptyModelChainError, UnknownProviderError } from './agent-loop';
import type { AgentLoopRequest, ModelProviders } from './agent-loop';
import { BudgetLevel } from './budget';

const MODEL = { provider: 'stub', model: 'test-model' };
const FALLBACK_MODEL = { provider: 'backup', model: 'fallback-model' };
const PRICE: ModelPrice = {
  inputPerMTokUsd: 1,
  outputPerMTokUsd: 1,
  cacheReadPerMTokUsd: 1,
  cacheWritePerMTokUsd: 1,
  reasoningPerMTokUsd: 1,
};
const PRICES = {
  [formatModelRef(MODEL)]: PRICE,
  [formatModelRef(FALLBACK_MODEL)]: PRICE,
  'stub:fallback-model': PRICE,
};
const LIMITS = { maxTurns: 5, timeoutMs: 60_000, maxTokensPerCall: 1_000, callTimeoutMs: 10_000 };
const AGENT = 'tester';

const lookupTool = defineTool({
  name: 'lookup',
  description: 'Look something up',
  inputSchema: z.object({ query: z.string() }),
  readOnly: true,
  handler: ({ query }) => Promise.resolve(`status of ${query}: fine`),
});

const failingTool = defineTool({
  name: 'lookup',
  description: 'Always fails',
  inputSchema: z.object({ query: z.string() }),
  readOnly: true,
  handler: () => Promise.reject(new Error('upstream unavailable')),
});

const baseRequest = (overrides: Partial<AgentLoopRequest> = {}): AgentLoopRequest => ({
  models: [MODEL],
  system: 'You are a test agent.',
  prompt: 'What is the status?',
  budgets: { perRunUsd: 10 },
  priorSpend: { taskUsd: 0, agentDayUsd: 0 },
  limits: LIMITS,
  ...overrides,
});

interface HarnessOptions {
  tools?: Tool[];
  allowlist?: string[];
  clock?: FixedClock;
}

const isModelPort = (candidate: ModelPort | ModelProviders): candidate is ModelPort =>
  'generate' in candidate && typeof candidate.generate === 'function';

async function harness(model: ModelPort | ModelProviders, options: HarnessOptions = {}) {
  const providers: ModelProviders = isModelPort(model) ? { stub: model } : model;
  const clock = options.clock ?? new FixedClock(1_000);
  const runs = new InMemoryRunRepository();
  const registry = await ToolRegistry.create(
    [new NativeToolSource(options.tools ?? [lookupTool])],
    options.allowlist ?? ['lookup'],
  );
  const run = Run.start(
    { id: 'run-1', agent: AGENT, trigger: RunTrigger.MANUAL, model: formatModelRef(MODEL) },
    clock,
  );
  return { loop: new AgentLoop({ providers, registry, runs, clock, prices: PRICES }), runs, run };
}

const scripted = (script: StubScript): StubModelAdapter => new StubModelAdapter(script);
const scenario = (name: StubScenario): StubModelAdapter => scripted(createStubScript(name));

const textReplies = (...texts: string[]): StubScript => ({
  respond: (request, callIndex) => ({
    model: formatModelRef({ provider: 'stub', model: request.model }),
    content: [{ type: ContentPartType.TEXT, text: texts[callIndex] ?? '' }],
    stopReason: StopReason.END,
    usage: DEFAULT_STUB_USAGE,
  }),
});

describe('AgentLoop', () => {
  it('completes a normal run through a tool call', async () => {
    const { loop, run, runs } = await harness(scenario(StubScenario.NORMAL));

    const result = await loop.run(run, baseRequest());

    expect(result.output).toBe(DEFAULT_STUB_FINAL_TEXT);
    expect(result.run).toMatchObject({
      status: RunStatus.COMPLETED,
      stopReason: RunStopReason.END,
      turns: 2,
      toolCalls: { lookup: 1 },
    });
    expect(result.run.costUsd).toBeGreaterThan(0);
    expect(await runs.spentUsd({ agent: AGENT, sinceMs: 0 })).toBeCloseTo(result.run.costUsd);
  });

  it('feeds the tool result back to the model', async () => {
    const model = scenario(StubScenario.NORMAL);
    const { loop, run } = await harness(model);

    await loop.run(run, baseRequest());

    const toolMessage = model.requests[1]?.messages.at(-1);
    expect(toolMessage?.role).toBe(MessageRole.USER);
    expect(toolMessage?.content[0]).toMatchObject({
      type: ContentPartType.TOOL_RESULT,
      result: { isError: false, content: 'status of status: fine' },
    });
  });

  it('saves the run as running before the first model call', async () => {
    const observed: number[] = [];
    const repository: { runs?: InMemoryRunRepository } = {};
    const spy: ModelPort = {
      capabilities: new StubModelAdapter(createStubScript(StubScenario.NORMAL)).capabilities,
      generate: async (request: ModelRequest): Promise<ModelResponse> => {
        observed.push((await repository.runs?.findRunning(AGENT))?.length ?? 0);
        return createStubScript(StubScenario.REFUSAL).respond(request, 0);
      },
    };
    const { loop, run, runs } = await harness(spy);
    repository.runs = runs;

    await loop.run(run, baseRequest());

    expect(observed).toEqual([1]);
  });

  it('stops a runaway loop at maxTurns', async () => {
    const { loop, run } = await harness(scenario(StubScenario.RUNAWAY));

    const result = await loop.run(run, baseRequest({ limits: { ...LIMITS, maxTurns: 3 } }));

    expect(result.run).toMatchObject({
      status: RunStatus.STOPPED,
      stopReason: RunStopReason.MAX_TURNS,
      turns: 3,
    });
  });

  it('lets the model recover from a failing tool', async () => {
    const { loop, run } = await harness(scenario(StubScenario.TOOL_ERROR), {
      tools: [failingTool],
    });

    const result = await loop.run(run, baseRequest());

    expect(result.output).toBe(TOOL_ERROR_FINAL_TEXT);
    expect(result.run.status).toBe(RunStatus.COMPLETED);
  });

  it('records a refusal as a stop reason', async () => {
    const { loop, run } = await harness(scenario(StubScenario.REFUSAL));

    const result = await loop.run(run, baseRequest());

    expect(result.run).toMatchObject({
      status: RunStatus.STOPPED,
      stopReason: RunStopReason.REFUSAL,
      turns: 1,
    });
  });

  it('stops when the model runs out of output tokens', async () => {
    const truncated: StubScript = {
      respond: (request) => ({
        model: formatModelRef({ provider: 'stub', model: request.model }),
        content: [{ type: ContentPartType.TEXT, text: 'partial' }],
        stopReason: StopReason.MAX_TOKENS,
        usage: DEFAULT_STUB_USAGE,
      }),
    };
    const { loop, run } = await harness(scripted(truncated));

    const result = await loop.run(run, baseRequest());

    expect(result).toMatchObject({ output: 'partial' });
    expect(result.run.stopReason).toBe(RunStopReason.MAX_TOKENS);
  });

  describe('budget', () => {
    it('stops before the call that could overshoot the run budget', async () => {
      const model = scenario(StubScenario.BUDGET_EXCEEDED);
      const { loop, run } = await harness(model);

      const result = await loop.run(run, baseRequest({ budgets: { perRunUsd: 1 } }));

      expect(result.run).toMatchObject({
        status: RunStatus.STOPPED,
        stopReason: RunStopReason.BUDGET_EXCEEDED,
        stopDetail: BudgetLevel.RUN,
        turns: 1,
      });
      expect(model.requests).toHaveLength(1);
    });

    it('refuses the very first call when its worst case exceeds the per-call cap', async () => {
      const model = scenario(StubScenario.NORMAL);
      const { loop, run } = await harness(model);

      const result = await loop.run(run, baseRequest({ budgets: { perCallUsd: 0.0001 } }));

      expect(result.run).toMatchObject({
        stopReason: RunStopReason.BUDGET_EXCEEDED,
        stopDetail: BudgetLevel.CALL,
        turns: 0,
      });
      expect(model.requests).toHaveLength(0);
    });

    it('refuses a call that would push the agent day over its cap', async () => {
      const model = scenario(StubScenario.NORMAL);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({
          budgets: { perDayUsd: 0.5 },
          priorSpend: { taskUsd: 0, agentDayUsd: 0.4999 },
        }),
      );

      expect(result.run).toMatchObject({
        stopReason: RunStopReason.BUDGET_EXCEEDED,
        stopDetail: BudgetLevel.AGENT_DAY,
      });
    });
  });

  describe('failures', () => {
    it('marks the run failed on a transport error and keeps the record', async () => {
      const { loop, run, runs } = await harness(scenario(StubScenario.TRANSPORT_FAILURE));

      const result = await loop.run(run, baseRequest());

      expect(result.run).toMatchObject({
        status: RunStatus.FAILED,
        stopReason: RunStopReason.MODEL_ERROR,
        stopDetail: STUB_TRANSPORT_FAILURE_MESSAGE,
      });
      expect(await runs.findRunning(AGENT)).toEqual([]);
    });

    it('records a client error as a model_error stop', async () => {
      const rejected: StubScript = {
        respond: () => {
          throw new ModelError(ModelErrorCategory.CLIENT, 'bad request', 400);
        },
      };
      const { loop, run } = await harness(scripted(rejected));

      const result = await loop.run(run, baseRequest());

      expect(result.run.stopReason).toBe(RunStopReason.MODEL_ERROR);
    });

    it('marks the run failed and rethrows an unexpected error', async () => {
      const broken: StubScript = {
        respond: () => {
          throw new TypeError('bug');
        },
      };
      const { loop, run, runs } = await harness(scripted(broken));

      await expect(loop.run(run, baseRequest())).rejects.toThrow(TypeError);

      expect(await runs.findRunning(AGENT)).toEqual([]);
      expect(run.snapshot()).toMatchObject({
        status: RunStatus.FAILED,
        stopReason: RunStopReason.UNEXPECTED_ERROR,
      });
    });

    it('fails the run when the model asks for tools but sends no calls', async () => {
      const empty: StubScript = {
        respond: (request) => ({
          model: formatModelRef({ provider: 'stub', model: request.model }),
          content: [],
          stopReason: StopReason.TOOL_USE,
          usage: DEFAULT_STUB_USAGE,
        }),
      };
      const { loop, run } = await harness(scripted(empty));

      const result = await loop.run(run, baseRequest());

      expect(result.run.stopReason).toBe(RunStopReason.MODEL_ERROR);
    });

    it('rejects a request without models', async () => {
      const { loop, run } = await harness(scenario(StubScenario.NORMAL));

      await expect(loop.run(run, baseRequest({ models: [] }))).rejects.toBeInstanceOf(
        EmptyModelChainError,
      );
    });
  });

  it('falls back to the next model when the first turn hits a transport error', async () => {
    const secondary = scenario(StubScenario.NORMAL);
    const { loop, run } = await harness({
      stub: scenario(StubScenario.TRANSPORT_FAILURE),
      backup: secondary,
    });

    const result = await loop.run(run, baseRequest({ models: [MODEL, FALLBACK_MODEL] }));

    expect(result.run).toMatchObject({
      status: RunStatus.COMPLETED,
      model: 'stub:fallback-model',
    });
    expect(secondary.requests).toHaveLength(2);
  });

  it('starts every run on the primary model again', async () => {
    const primary = scenario(StubScenario.REFUSAL);
    const providers = { stub: primary, backup: scenario(StubScenario.REFUSAL) };
    const first = await harness(providers);
    const second = await harness(providers);

    await first.loop.run(first.run, baseRequest({ models: [MODEL, FALLBACK_MODEL] }));
    await second.loop.run(second.run, baseRequest({ models: [MODEL, FALLBACK_MODEL] }));

    expect(primary.requests).toHaveLength(2);
  });

  it('fails fast when a model in the chain has no adapter or no price', async () => {
    const { loop, run } = await harness(scenario(StubScenario.NORMAL));
    const unknownProvider = { provider: 'ghost', model: 'm' };
    const unpriced = { provider: 'stub', model: 'unpriced' };

    await expect(loop.run(run, baseRequest({ models: [unknownProvider] }))).rejects.toBeInstanceOf(
      UnknownProviderError,
    );
    await expect(loop.run(run, baseRequest({ models: [unpriced] }))).rejects.toBeInstanceOf(
      MissingModelPriceError,
    );
  });

  describe('time', () => {
    it('stops at the wall-clock timeout', async () => {
      const clock = new FixedClock(1_000);
      const slowTool = defineTool({
        name: 'lookup',
        description: 'Slow',
        inputSchema: z.object({ query: z.string() }),
        readOnly: true,
        handler: () => {
          clock.advance(LIMITS.timeoutMs + 1);
          return Promise.resolve('late');
        },
      });
      const { loop, run } = await harness(scenario(StubScenario.RUNAWAY), {
        tools: [slowTool],
        clock,
      });

      const result = await loop.run(run, baseRequest());

      expect(result.run).toMatchObject({
        status: RunStatus.STOPPED,
        stopReason: RunStopReason.TIMEOUT,
        turns: 1,
      });
    });

    it('does not wait for a tool that never finishes', async () => {
      const hangingTool = defineTool({
        name: 'lookup',
        description: 'Hangs',
        inputSchema: z.object({ query: z.string() }),
        readOnly: true,
        handler: () => new Promise<string>(() => undefined),
      });
      const model = scenario(StubScenario.NORMAL);
      const { loop, run } = await harness(model, { tools: [hangingTool] });
      const timeoutMs = 20;

      const result = await loop.run(run, baseRequest({ limits: { ...LIMITS, timeoutMs } }));

      expect(model.requests[1]?.messages.at(-1)?.content[0]).toMatchObject({
        result: { isError: true, content: expect.stringContaining('deadline') },
      });
      expect(result.run.status).toBe(RunStatus.COMPLETED);
    });

    it('shortens the call timeout to what is left of the run deadline', async () => {
      const clock = new FixedClock(1_000);
      const model = scenario(StubScenario.REFUSAL);
      const { loop, run } = await harness(model, { clock });
      clock.advance(LIMITS.timeoutMs - 500);

      await loop.run(run, baseRequest());

      expect(model.requests[0]?.timeoutMs).toBe(500);
    });
  });

  it('denies a tool the manifest did not allow and keeps going', async () => {
    const model = scenario(StubScenario.NORMAL);
    const { loop, run } = await harness(model, { allowlist: [] });

    const result = await loop.run(run, baseRequest());

    const toolMessage = model.requests[1]?.messages.at(-1);
    expect(toolMessage?.content[0]).toMatchObject({ result: { isError: true } });
    expect(result.run.status).toBe(RunStatus.COMPLETED);
  });

  it('continues after a paused turn', async () => {
    const paused: StubScript = {
      respond: (request, callIndex) => ({
        model: formatModelRef({ provider: 'stub', model: request.model }),
        content: [{ type: ContentPartType.TEXT, text: callIndex === 0 ? '' : 'resumed' }],
        stopReason: callIndex === 0 ? StopReason.PAUSED : StopReason.END,
        usage: DEFAULT_STUB_USAGE,
      }),
    };
    const { loop, run } = await harness(scripted(paused));

    const result = await loop.run(run, baseRequest());

    expect(result).toMatchObject({ output: 'resumed' });
    expect(result.run.turns).toBe(2);
  });

  describe('final answer turn', () => {
    const schema = z.object({ headline: z.string() });
    const FINAL_PROMPT = 'No tool turns are left: answer now.';

    const answersOnlyWithoutTools: StubScript = {
      respond: (request, callIndex) => {
        const model = formatModelRef({ provider: 'stub', model: request.model });
        if (request.toolChoice !== ToolChoice.NONE)
          return createStubScript(StubScenario.RUNAWAY).respond(request, callIndex);
        return {
          model,
          content: [{ type: ContentPartType.TEXT, text: '{"headline":"partial"}' }],
          stopReason: StopReason.END,
          usage: DEFAULT_STUB_USAGE,
        };
      },
    };

    it('takes the tools away on the last allowed turn and accepts the answer', async () => {
      const model = scripted(answersOnlyWithoutTools);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          limits: { ...LIMITS, maxTurns: 3 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(result.value).toEqual({ headline: 'partial' });
      expect(result.run).toMatchObject({ stopReason: RunStopReason.END, turns: 3 });
      expect(model.requests.map((request) => request.toolChoice === ToolChoice.NONE)).toEqual([
        false,
        false,
        true,
      ]);
      expect(model.requests.every((request) => request.tools.length > 0)).toBe(true);
    });

    it('puts the instruction after the tool results in the same user message', async () => {
      const model = scripted(answersOnlyWithoutTools);
      const { loop, run } = await harness(model);

      await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          limits: { ...LIMITS, maxTurns: 2 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      const last = model.requests[1]?.messages.at(-1);
      expect(last?.role).toBe(MessageRole.USER);
      expect(last?.content.map((part) => part.type)).toEqual([
        ContentPartType.TOOL_RESULT,
        ContentPartType.TEXT,
      ]);
    });

    it('keeps the tool definitions on the final turn so earlier tool blocks stay valid', async () => {
      const model = scripted(answersOnlyWithoutTools);
      const { loop, run } = await harness(model);

      await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          limits: { ...LIMITS, maxTurns: 3 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(model.requests.at(-1)?.tools.map((tool) => tool.name)).toEqual(['lookup']);
    });

    it('treats a tool call on the final turn as no answer and does not run it', async () => {
      const stubborn: StubScript = {
        respond: (request, callIndex) => ({
          model: formatModelRef({ provider: 'stub', model: request.model }),
          content: [
            {
              type: ContentPartType.TOOL_CALL,
              call: {
                id: `call-${callIndex}`,
                name: 'lookup',
                input: { query: String(callIndex) },
              },
            },
          ],
          stopReason: StopReason.TOOL_USE,
          usage: DEFAULT_STUB_USAGE,
        }),
      };
      const { loop, run } = await harness(scripted(stubborn));

      const result = await loop.run(
        run,
        baseRequest({ limits: { ...LIMITS, maxTurns: 3 }, finalAnswer: { prompt: FINAL_PROMPT } }),
      );

      expect(result.run).toMatchObject({
        stopReason: RunStopReason.MAX_TURNS,
        stopDetail: 'tool use requested on the final answer turn',
        turns: 3,
      });
      expect(result.run.toolCalls).toEqual({ lookup: 2 });
    });

    it('asks for the final answer before the deadline leaves time for only one more call', async () => {
      const clock = new FixedClock(1_000);
      const slow: StubScript = {
        respond: (request, callIndex) => {
          clock.advance(25_000);
          return answersOnlyWithoutTools.respond(request, callIndex);
        },
      };
      const model = scripted(slow);
      const { loop, run } = await harness(model, { clock });

      const result = await loop.run(
        run,
        baseRequest({ responseSchema: schema, finalAnswer: { prompt: FINAL_PROMPT } }),
      );

      expect(result.value).toEqual({ headline: 'partial' });
      expect(result.run.stopReason).toBe(RunStopReason.END);
      expect(model.requests.at(-1)?.toolChoice).toBe(ToolChoice.NONE);
    });

    it('allows one repair turn after an invalid final answer instead of ending with max_turns', async () => {
      const invalidThenValid: StubScript = {
        respond: (request, callIndex) => {
          const model = formatModelRef({ provider: 'stub', model: request.model });
          if (request.toolChoice !== ToolChoice.NONE)
            return createStubScript(StubScenario.RUNAWAY).respond(request, callIndex);
          const repairing = request.messages.some((message) =>
            message.content.some(
              (part) => part.type === ContentPartType.TEXT && part.text.includes('did not match'),
            ),
          );
          return {
            model,
            content: [
              {
                type: ContentPartType.TEXT,
                text: repairing ? '{"headline":"repaired"}' : '{"nonsense":true}',
              },
            ],
            stopReason: StopReason.END,
            usage: DEFAULT_STUB_USAGE,
          };
        },
      };
      const model = scripted(invalidThenValid);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          limits: { ...LIMITS, maxTurns: 3 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(result.value).toEqual({ headline: 'repaired' });
      expect(result.run).toMatchObject({ stopReason: RunStopReason.END, turns: 4 });
      expect(model.requests.at(-1)?.toolChoice).toBe(ToolChoice.NONE);
    });

    it('does not allow a second repair after the final answer turn', async () => {
      const alwaysInvalid: StubScript = {
        respond: (request, callIndex) =>
          request.toolChoice !== ToolChoice.NONE
            ? createStubScript(StubScenario.RUNAWAY).respond(request, callIndex)
            : {
                model: formatModelRef({ provider: 'stub', model: request.model }),
                content: [{ type: ContentPartType.TEXT, text: '{"nonsense":true}' }],
                stopReason: StopReason.END,
                usage: DEFAULT_STUB_USAGE,
              },
      };
      const { loop, run } = await harness(scripted(alwaysInvalid));

      const result = await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          limits: { ...LIMITS, maxTurns: 3 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(result.value).toBeUndefined();
      expect(result.run).toMatchObject({ stopReason: RunStopReason.INVALID_OUTPUT, turns: 4 });
    });

    it('keeps the old behaviour when the option is not set', async () => {
      const { loop, run } = await harness(scripted(answersOnlyWithoutTools));

      const result = await loop.run(
        run,
        baseRequest({ responseSchema: schema, limits: { ...LIMITS, maxTurns: 3 } }),
      );

      expect(result.run.stopReason).toBe(RunStopReason.MAX_TURNS);
      expect(result.value).toBeUndefined();
    });

    it('asks for the final answer while the budget can still pay for it', async () => {
      const model = scripted(answersOnlyWithoutTools);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          budgets: { perRunUsd: 0.0026 },
          limits: { ...LIMITS, maxTurns: 10 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(result.value).toEqual({ headline: 'partial' });
      expect(result.run.stopReason).toBe(RunStopReason.END);
      const forbidden = model.requests.map((request) => request.toolChoice === ToolChoice.NONE);
      expect(forbidden.at(-1)).toBe(true);
      expect(forbidden.slice(0, -1).some(Boolean)).toBe(false);
      expect(forbidden.length).toBeLessThan(10);
    });
  });

  describe('final answer reserve', () => {
    const schema = z.object({ headline: z.string() });
    const FINAL_PROMPT = 'No tool turns are left: answer now.';
    const answerWithoutTools: StubScript = {
      respond: (request, callIndex) => ({
        model: formatModelRef({ provider: 'stub', model: request.model }),
        content:
          request.toolChoice === ToolChoice.NONE
            ? [{ type: ContentPartType.TEXT, text: '{"headline":"early"}' }]
            : [
                {
                  type: ContentPartType.TOOL_CALL,
                  call: { id: `call-${callIndex}`, name: 'lookup', input: { query: 'x' } },
                },
              ],
        stopReason: request.toolChoice === ToolChoice.NONE ? StopReason.END : StopReason.TOOL_USE,
        usage: DEFAULT_STUB_USAGE,
      }),
    };

    it('finalizes on the very first turn when the budget cannot pay for a turn and a final call', async () => {
      const model = scripted(answerWithoutTools);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          budgets: { perRunUsd: 0.0015 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(result.value).toEqual({ headline: 'early' });
      expect(model.requests).toHaveLength(1);
      expect(model.requests[0]?.toolChoice).toBe(ToolChoice.NONE);
    });

    it('does not finalize at turn zero when the budget is ample', async () => {
      const model = scripted(answerWithoutTools);
      const { loop, run } = await harness(model);

      await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          budgets: { perRunUsd: 10 },
          limits: { ...LIMITS, maxTurns: 2 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(model.requests[0]?.toolChoice).toBeUndefined();
    });

    it('does not count the per-call level twice', async () => {
      const model = scripted(answerWithoutTools);
      const { loop, run } = await harness(model);

      await loop.run(
        run,
        baseRequest({
          responseSchema: schema,
          budgets: { perRunUsd: 10, perCallUsd: 0.0016 },
          limits: { ...LIMITS, maxTurns: 2 },
          finalAnswer: { prompt: FINAL_PROMPT },
        }),
      );

      expect(model.requests[0]?.toolChoice).toBeUndefined();
    });

    it('does not look at the reserve when no final answer is configured', async () => {
      const model = scripted(answerWithoutTools);
      const { loop, run } = await harness(model);

      const result = await loop.run(
        run,
        baseRequest({ responseSchema: schema, budgets: { perRunUsd: 0.0015 } }),
      );

      expect(model.requests.every((request) => request.toolChoice === undefined)).toBe(true);
      expect(result.run.stopReason).not.toBe(RunStopReason.END);
    });
  });

  describe('structured output', () => {
    const schema = z.object({ headline: z.string() });

    it('returns the validated value', async () => {
      const { loop, run } = await harness(scripted(textReplies('{"headline":"ok"}')));

      const result = await loop.run(run, baseRequest({ responseSchema: schema }));

      expect(result.value).toEqual({ headline: 'ok' });
      expect(result.run.turns).toBe(1);
    });

    it('asks once for a repair and accepts the corrected reply', async () => {
      const model = scripted(textReplies('not json', '{"headline":"fixed"}'));
      const { loop, run } = await harness(model);

      const result = await loop.run(run, baseRequest({ responseSchema: schema }));

      expect(result.value).toEqual({ headline: 'fixed' });
      expect(result.run.turns).toBe(2);
      expect(model.requests[1]?.messages.at(-1)?.role).toBe(MessageRole.USER);
    });

    it('gives up after one failed repair', async () => {
      const model = scripted(textReplies('nope', 'still nope', '{"headline":"late"}'));
      const { loop, run } = await harness(model);

      const result = await loop.run(run, baseRequest({ responseSchema: schema }));

      expect(result.run).toMatchObject({
        status: RunStatus.STOPPED,
        stopReason: RunStopReason.INVALID_OUTPUT,
        turns: 2,
      });
      expect(result.value).toBeUndefined();
    });

    it('sends the response schema to the model', async () => {
      const model = scripted(textReplies('{"headline":"ok"}'));
      const { loop, run } = await harness(model);

      await loop.run(run, baseRequest({ responseSchema: schema }));

      expect(model.requests[0]?.responseSchema?.jsonSchema).toMatchObject({ type: 'object' });
    });
  });

  describe('tool names the model invents', () => {
    const invented = (count: number): StubScript => ({
      respond: (request, callIndex) => ({
        model: formatModelRef({ provider: 'stub', model: request.model }),
        content:
          callIndex === 0
            ? [
                ...Array.from({ length: count }, (_, index) => ({
                  type: ContentPartType.TOOL_CALL,
                  call: { id: `call-${index}`, name: `invented-tool-${index}`, input: {} },
                })),
                {
                  type: ContentPartType.TOOL_CALL,
                  call: { id: 'call-real', name: 'lookup', input: { query: 'x' } },
                },
              ]
            : [{ type: ContentPartType.TEXT, text: 'done' }],
        stopReason: callIndex === 0 ? StopReason.TOOL_USE : StopReason.END,
        usage: DEFAULT_STUB_USAGE,
      }),
    });

    it('are counted under one name, so a run cannot create a label value per invented name', async () => {
      const { loop, run } = await harness(scripted(invented(100)));

      const result = await loop.run(run, baseRequest());

      expect(result.run.toolCalls).toEqual({ lookup: 1, unknown_tool: 100 });
      expect(Object.keys(result.run.toolCalls)).toHaveLength(2);
    });
  });
});
