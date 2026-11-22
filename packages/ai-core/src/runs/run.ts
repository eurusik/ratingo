import type { ClockPort } from '../clock/clock.port';
import type { ModelUsage } from '../model/model.types';
import { EMPTY_USAGE, addUsage } from '../model/model.types';

export const RunStatus = {
  RUNNING: 'running',
  COMPLETED: 'completed',
  STOPPED: 'stopped',
  FAILED: 'failed',
  INTERRUPTED: 'interrupted',
} as const;
export type RunStatus = (typeof RunStatus)[keyof typeof RunStatus];

export const RunStopReason = {
  END: 'end',
  MAX_TURNS: 'max_turns',
  MAX_TOKENS: 'max_tokens',
  REFUSAL: 'refusal',
  BUDGET_EXCEEDED: 'budget_exceeded',
  TIMEOUT: 'timeout',
  INVALID_OUTPUT: 'invalid_output',
  MODEL_ERROR: 'model_error',
  UNEXPECTED_ERROR: 'unexpected_error',
  INTERRUPTED: 'interrupted',
} as const;
export type RunStopReason = (typeof RunStopReason)[keyof typeof RunStopReason];

export const RunTrigger = {
  SCHEDULE: 'schedule',
  WEBHOOK: 'webhook',
  CHAT: 'chat',
  BUTTON: 'button',
  MANUAL: 'manual',
} as const;
export type RunTrigger = (typeof RunTrigger)[keyof typeof RunTrigger];

export interface RunSnapshot {
  id: string;
  agent: string;
  task?: string;
  trigger: RunTrigger;
  model: string;
  status: RunStatus;
  stopReason?: RunStopReason;
  stopDetail?: string;
  startedAtMs: number;
  finishedAtMs?: number;
  turns: number;
  usage: ModelUsage;
  costUsd: number;
  toolCalls: Record<string, number>;
}

export interface RunStartInput {
  id: string;
  agent: string;
  task?: string;
  trigger: RunTrigger;
  model: string;
}

export class InvalidRunValueError extends Error {
  constructor(field: string, value: number) {
    super(`Run ${field} must be a finite number >= 0, got ${value}`);
    this.name = 'InvalidRunValueError';
  }
}

export class InvalidRunSnapshotError extends Error {
  constructor(runId: string, reason: string) {
    super(`Run ${runId} snapshot is inconsistent: ${reason}`);
    this.name = 'InvalidRunSnapshotError';
  }
}

export class RunAlreadyFinishedError extends Error {
  constructor(runId: string) {
    super(`Run ${runId} is already finished`);
    this.name = 'RunAlreadyFinishedError';
  }
}

const STATUS_BY_STOP_REASON: Record<RunStopReason, RunStatus> = {
  [RunStopReason.END]: RunStatus.COMPLETED,
  [RunStopReason.MAX_TURNS]: RunStatus.STOPPED,
  [RunStopReason.MAX_TOKENS]: RunStatus.STOPPED,
  [RunStopReason.REFUSAL]: RunStatus.STOPPED,
  [RunStopReason.BUDGET_EXCEEDED]: RunStatus.STOPPED,
  [RunStopReason.TIMEOUT]: RunStatus.STOPPED,
  [RunStopReason.INVALID_OUTPUT]: RunStatus.STOPPED,
  [RunStopReason.MODEL_ERROR]: RunStatus.FAILED,
  [RunStopReason.UNEXPECTED_ERROR]: RunStatus.FAILED,
  [RunStopReason.INTERRUPTED]: RunStatus.INTERRUPTED,
};

function assertNonNegative(field: string, value: number): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new InvalidRunValueError(field, value);
  }
}

function assertConsistent(snapshot: RunSnapshot): void {
  const finished = snapshot.status !== RunStatus.RUNNING;
  if (finished && (snapshot.stopReason === undefined || snapshot.finishedAtMs === undefined)) {
    throw new InvalidRunSnapshotError(
      snapshot.id,
      'a finished run needs stopReason and finishedAtMs',
    );
  }
  if (!finished && (snapshot.stopReason !== undefined || snapshot.finishedAtMs !== undefined)) {
    throw new InvalidRunSnapshotError(
      snapshot.id,
      'a running run cannot have stopReason or finishedAtMs',
    );
  }
}

function copySnapshot(snapshot: RunSnapshot): RunSnapshot {
  return { ...snapshot, usage: { ...snapshot.usage }, toolCalls: { ...snapshot.toolCalls } };
}

export class Run {
  private constructor(private current: RunSnapshot) {}

  static start(input: RunStartInput, clock: ClockPort): Run {
    return new Run({
      ...input,
      status: RunStatus.RUNNING,
      startedAtMs: clock.nowMs(),
      turns: 0,
      usage: { ...EMPTY_USAGE },
      costUsd: 0,
      toolCalls: {},
    });
  }

  static restore(snapshot: RunSnapshot): Run {
    assertConsistent(snapshot);
    return new Run(copySnapshot(snapshot));
  }

  get id(): string {
    return this.current.id;
  }

  get startedAtMs(): number {
    return this.current.startedAtMs;
  }

  get turns(): number {
    return this.current.turns;
  }

  get costUsd(): number {
    return this.current.costUsd;
  }

  get isRunning(): boolean {
    return this.current.status === RunStatus.RUNNING;
  }

  recordTurn(usage: ModelUsage, costUsd: number, model: string): void {
    this.assertRunning();
    assertNonNegative('costUsd', costUsd);
    (Object.entries(usage) as [string, number][]).forEach(([field, value]) =>
      assertNonNegative(field, value),
    );
    this.current = {
      ...this.current,
      model,
      turns: this.current.turns + 1,
      usage: addUsage(this.current.usage, usage),
      costUsd: this.current.costUsd + costUsd,
    };
  }

  recordToolCall(toolName: string): void {
    this.assertRunning();
    this.current = {
      ...this.current,
      toolCalls: {
        ...this.current.toolCalls,
        [toolName]: (this.current.toolCalls[toolName] ?? 0) + 1,
      },
    };
  }

  finish(stopReason: RunStopReason, clock: ClockPort, stopDetail?: string): void {
    this.assertRunning();
    this.current = {
      ...this.current,
      status: STATUS_BY_STOP_REASON[stopReason],
      stopReason,
      ...(stopDetail === undefined ? {} : { stopDetail }),
      finishedAtMs: clock.nowMs(),
    };
  }

  markInterrupted(clock: ClockPort): void {
    this.finish(RunStopReason.INTERRUPTED, clock);
  }

  snapshot(): RunSnapshot {
    return copySnapshot(this.current);
  }

  private assertRunning(): void {
    if (!this.isRunning) {
      throw new RunAlreadyFinishedError(this.current.id);
    }
  }
}
