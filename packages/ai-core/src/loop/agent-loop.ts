import type { ZodType } from 'zod';
import type { ClockPort } from '../clock/clock.port';
import { ModelError, ModelErrorCategory } from '../model/model.errors';
import type { ModelPort } from '../model/model.port';
import { FallbackModelPort } from '../model/model-fallback';
import type { ModelRef } from '../model/model-ref';
import type { PriceTable } from '../model/model-pricing';
import { calculateCostUsd, priceFor, worstCaseCostUsd } from '../model/model-pricing';
import type {
  ChatMessage,
  ModelRequest,
  ModelResponse,
  ToolCall,
  ToolResult,
} from '../model/model.types';
import {
  ContentPartType,
  MessageRole,
  StopReason,
  ToolChoice,
  textMessage,
  textOf,
  toolCallsOf,
} from '../model/model.types';
import type { Run, RunSnapshot } from '../runs/run';
import { RunStopReason } from '../runs/run';
import type { RunRepository } from '../runs/run.repository';
import { describeError } from '../shared/describe-error';
import { redactSecrets } from '../tools/redact';
import type { ToolRegistry } from '../tools/tool-registry';
import type { BudgetLimits, PriorSpend } from './budget';
import { BudgetLevel, buildBudgetLevels, estimateInputTokens, evaluateBudget } from './budget';
import { buildRepairPrompt, toResponseSchema, validateStructuredOutput } from './structured-output';

const RESPONSE_SCHEMA_NAME = 'response';
const MIN_CALL_TIMEOUT_MS = 1;
const TOOL_TIMEOUT_MESSAGE = 'Tool did not finish before the run deadline';
const TOOL_USE_ON_FINAL_TURN_DETAIL = 'tool use requested on the final answer turn';
const TOOL_USE_WITHOUT_CALLS_DETAIL = 'tool_use stop without tool calls';

export interface LoopLimits {
  maxTurns: number;
  timeoutMs: number;
  maxTokensPerCall: number;
  callTimeoutMs: number;
}

export interface FinalAnswerPolicy {
  prompt: string;
}

export type ModelProviders = Readonly<Record<string, ModelPort>>;

export interface AgentLoopDependencies {
  providers: ModelProviders;
  registry: ToolRegistry;
  runs: RunRepository;
  clock: ClockPort;
  prices: PriceTable;
}

export interface AgentLoopRequest {
  models: readonly ModelRef[];
  system: string;
  prompt: string;
  responseSchema?: ZodType;
  budgets: BudgetLimits;
  priorSpend: PriorSpend;
  limits: LoopLimits;
  finalAnswer?: FinalAnswerPolicy;
}

export interface AgentLoopResult {
  run: RunSnapshot;
  output: string;
  value?: unknown;
}

interface LoopState {
  model: ModelPort;
  messages: ChatMessage[];
  repairUsed: boolean;
  finalizing: boolean;
  output: string;
  value?: unknown;
}

interface LoopStop {
  reason: RunStopReason;
  detail?: string;
}

export class UnknownProviderError extends Error {
  constructor(provider: string) {
    super(`No model adapter is registered for provider "${provider}"`);
    this.name = 'UnknownProviderError';
  }
}

export class EmptyModelChainError extends Error {
  constructor() {
    super('An agent loop request needs at least one model');
    this.name = 'EmptyModelChainError';
  }
}

const UNKNOWN_TOOL_NAME = 'unknown_tool';

export class AgentLoop {
  constructor(private readonly deps: AgentLoopDependencies) {}

  async run(run: Run, request: AgentLoopRequest): Promise<AgentLoopResult> {
    if (request.models.length === 0) {
      throw new EmptyModelChainError();
    }
    const state: LoopState = {
      model: this.buildModel(request.models),
      messages: [textMessage(MessageRole.USER, request.prompt)],
      repairUsed: false,
      finalizing: false,
      output: '',
    };
    request.models.forEach((ref) => priceFor(this.deps.prices, ref));
    const deadlineMs = run.startedAtMs + request.limits.timeoutMs;
    await this.deps.runs.save(run.snapshot());
    let failure: { error: unknown } | undefined;
    try {
      const stop = await this.drive(run, request, state, deadlineMs);
      run.finish(stop.reason, this.deps.clock, stop.detail);
    } catch (error) {
      failure = { error };
      this.markFailed(run, error);
    }
    this.deps.registry.forget(run.id);
    const snapshot = run.snapshot();
    await this.deps.runs.save(snapshot);
    if (failure !== undefined && !(failure.error instanceof ModelError)) {
      throw failure.error;
    }
    return {
      run: snapshot,
      output: state.output,
      ...(state.value === undefined ? {} : { value: state.value }),
    };
  }

  private buildModel(models: readonly ModelRef[]): ModelPort {
    return new FallbackModelPort(
      models.map((ref) => {
        const port = this.deps.providers[ref.provider];
        if (port === undefined) {
          throw new UnknownProviderError(ref.provider);
        }
        return { ref, port };
      }),
    );
  }

  private markFailed(run: Run, error: unknown): void {
    if (!run.isRunning) {
      return;
    }
    const reason =
      error instanceof ModelError ? RunStopReason.MODEL_ERROR : RunStopReason.UNEXPECTED_ERROR;
    run.finish(reason, this.deps.clock, stopDetailOf(error));
  }

  private async drive(
    run: Run,
    request: AgentLoopRequest,
    state: LoopState,
    deadlineMs: number,
  ): Promise<LoopStop> {
    for (;;) {
      this.finalizeBeforeLastChance(run, request, state, deadlineMs);
      const blocked =
        this.checkLimits(run, request, deadlineMs) ??
        this.checkBudgetOrFinalize(run, request, state);
      if (blocked !== undefined) {
        return blocked;
      }
      const response = await this.callModel(request, state, deadlineMs);
      this.recordTurn(run, response);
      await this.deps.runs.save(run.snapshot());
      const stop = await this.handleResponse(run, request, state, response, deadlineMs);
      if (stop !== undefined) {
        return stop;
      }
    }
  }

  private finalizeBeforeLastChance(
    run: Run,
    request: AgentLoopRequest,
    state: LoopState,
    deadlineMs: number,
  ): void {
    const onLastTurn = run.turns === request.limits.maxTurns - 1;
    const timeLeftForOneCallOnly =
      run.turns > 0 && deadlineMs - this.deps.clock.nowMs() <= request.limits.callTimeoutMs;
    if (onLastTurn || timeLeftForOneCallOnly) this.startFinalizing(request, state);
  }

  private startFinalizing(request: AgentLoopRequest, state: LoopState): void {
    if (request.finalAnswer === undefined || state.finalizing) return;
    state.finalizing = true;
    const last = state.messages[state.messages.length - 1];
    const note = { type: ContentPartType.TEXT, text: request.finalAnswer.prompt } as const;
    if (last !== undefined && last.role === MessageRole.USER) last.content.push(note);
    else state.messages.push({ role: MessageRole.USER, content: [note] });
  }

  private checkBudgetOrFinalize(
    run: Run,
    request: AgentLoopRequest,
    state: LoopState,
  ): LoopStop | undefined {
    if (
      request.finalAnswer !== undefined &&
      !state.finalizing &&
      !this.canAffordAnotherTurnAndTheFinalOne(run, request, state)
    ) {
      this.startFinalizing(request, state);
    }
    return this.checkBudget(run, request, state);
  }

  private canAffordAnotherTurnAndTheFinalOne(
    run: Run,
    request: AgentLoopRequest,
    state: LoopState,
  ): boolean {
    const modelRequest = this.buildModelRequest(request, state, request.limits.callTimeoutMs);
    const nextTurn = this.worstCaseUsd(request, modelRequest);
    const finalCall = this.worstCaseUsd(request, modelRequest, request.limits.maxTokensPerCall);
    const cumulative = buildBudgetLevels(request.budgets, request.priorSpend, run.costUsd).filter(
      (level) => level.level !== BudgetLevel.CALL,
    );
    return evaluateBudget(cumulative, nextTurn + finalCall).allowed;
  }

  private checkLimits(
    run: Run,
    request: AgentLoopRequest,
    deadlineMs: number,
  ): LoopStop | undefined {
    if (this.deps.clock.nowMs() >= deadlineMs) {
      return { reason: RunStopReason.TIMEOUT };
    }
    if (run.turns >= request.limits.maxTurns) {
      return { reason: RunStopReason.MAX_TURNS };
    }
    return undefined;
  }

  private checkBudget(run: Run, request: AgentLoopRequest, state: LoopState): LoopStop | undefined {
    const worstCaseUsd = this.worstCaseUsd(
      request,
      this.buildModelRequest(request, state, request.limits.callTimeoutMs),
    );
    const levels = buildBudgetLevels(request.budgets, request.priorSpend, run.costUsd);
    const decision = evaluateBudget(levels, worstCaseUsd);
    return decision.allowed
      ? undefined
      : { reason: RunStopReason.BUDGET_EXCEEDED, detail: decision.level };
  }

  private worstCaseUsd(
    request: AgentLoopRequest,
    modelRequest: ModelRequest,
    extraInputTokens = 0,
  ): number {
    const inputTokens = estimateInputTokens(modelRequest) + extraInputTokens;
    return Math.max(
      ...request.models.map((ref) =>
        worstCaseCostUsd(
          inputTokens,
          request.limits.maxTokensPerCall,
          priceFor(this.deps.prices, ref),
        ),
      ),
    );
  }

  private buildModelRequest(
    request: AgentLoopRequest,
    state: LoopState,
    timeoutMs: number,
  ): ModelRequest {
    return {
      model: (request.models[0] as ModelRef).model,
      system: request.system,
      messages: [...state.messages],
      tools: this.deps.registry.definitions(),
      ...(state.finalizing ? { toolChoice: ToolChoice.NONE } : {}),
      maxTokens: request.limits.maxTokensPerCall,
      timeoutMs,
      ...(request.responseSchema === undefined
        ? {}
        : { responseSchema: toResponseSchema(RESPONSE_SCHEMA_NAME, request.responseSchema) }),
    };
  }

  private callModel(
    request: AgentLoopRequest,
    state: LoopState,
    deadlineMs: number,
  ): Promise<ModelResponse> {
    const remainingMs = Math.max(MIN_CALL_TIMEOUT_MS, deadlineMs - this.deps.clock.nowMs());
    const timeoutMs = Math.min(request.limits.callTimeoutMs, remainingMs);
    return state.model.generate(this.buildModelRequest(request, state, timeoutMs));
  }

  private recordTurn(run: Run, response: ModelResponse): void {
    const costUsd = calculateCostUsd(response.usage, priceFor(this.deps.prices, response.model));
    run.recordTurn(response.usage, costUsd, response.model);
  }

  private handleResponse(
    run: Run,
    request: AgentLoopRequest,
    state: LoopState,
    response: ModelResponse,
    deadlineMs: number,
  ): LoopStop | Promise<LoopStop | undefined> | undefined {
    state.messages.push({ role: MessageRole.ASSISTANT, content: response.content });
    switch (response.stopReason) {
      case StopReason.END:
        return this.handleEnd(request, state, response);
      case StopReason.TOOL_USE:
        return state.finalizing
          ? { reason: RunStopReason.MAX_TURNS, detail: TOOL_USE_ON_FINAL_TURN_DETAIL }
          : this.handleToolUse(run, state, response, deadlineMs);
      case StopReason.PAUSED:
        return undefined;
      case StopReason.MAX_TOKENS:
        state.output = textOf(response.content);
        return { reason: RunStopReason.MAX_TOKENS };
      case StopReason.REFUSAL:
        return { reason: RunStopReason.REFUSAL };
    }
  }

  private handleEnd(
    request: AgentLoopRequest,
    state: LoopState,
    response: ModelResponse,
  ): LoopStop | undefined {
    state.output = textOf(response.content);
    if (request.responseSchema === undefined) {
      return { reason: RunStopReason.END };
    }
    const outcome = validateStructuredOutput(request.responseSchema, state.output);
    if (outcome.ok) {
      state.value = outcome.value;
      return { reason: RunStopReason.END };
    }
    if (state.repairUsed) {
      return { reason: RunStopReason.INVALID_OUTPUT, detail: outcome.issues };
    }
    state.repairUsed = true;
    state.messages.push(textMessage(MessageRole.USER, buildRepairPrompt(outcome.issues)));
    return undefined;
  }

  private async handleToolUse(
    run: Run,
    state: LoopState,
    response: ModelResponse,
    deadlineMs: number,
  ): Promise<LoopStop | undefined> {
    const calls = toolCallsOf(response.content);
    if (calls.length === 0) {
      return { reason: RunStopReason.MODEL_ERROR, detail: TOOL_USE_WITHOUT_CALLS_DETAIL };
    }
    const results = await this.executeTools(run, calls, deadlineMs);
    state.messages.push({
      role: MessageRole.USER,
      content: results.map((result) => ({ type: ContentPartType.TOOL_RESULT, result })),
    });
    return undefined;
  }

  private executeTools(
    run: Run,
    calls: readonly ToolCall[],
    deadlineMs: number,
  ): Promise<ToolResult[]> {
    for (const call of calls) {
      run.recordToolCall(this.deps.registry.has(call.name) ? call.name : UNKNOWN_TOOL_NAME);
    }
    const remainingMs = Math.max(MIN_CALL_TIMEOUT_MS, deadlineMs - this.deps.clock.nowMs());
    return Promise.all(
      calls.map((call) =>
        withTimeout(this.deps.registry.execute(call, { runId: run.id }), remainingMs, {
          callId: call.id,
          content: TOOL_TIMEOUT_MESSAGE,
          isError: true,
        }),
      ),
    );
  }
}

function stopDetailOf(error: unknown): string {
  if (error instanceof ModelError) {
    return [
      error.category === ModelErrorCategory.CLIENT ? error.category : error.message,
      ...(error.status === undefined ? [] : [`HTTP ${error.status}`]),
      ...(error.providerType === undefined ? [] : [error.providerType]),
    ].join(', ');
  }
  return redactSecrets(describeError(error));
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number, onTimeout: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(onTimeout), timeoutMs);
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}
