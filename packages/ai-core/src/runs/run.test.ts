import * as fc from 'fast-check';
import { FixedClock } from '../clock/fixed.clock';
import { EMPTY_USAGE } from '../model/model.types';
import {
  InvalidRunSnapshotError,
  InvalidRunValueError,
  Run,
  RunAlreadyFinishedError,
  RunStatus,
  RunStopReason,
  RunTrigger,
} from './run';

const startRun = (clock = new FixedClock(1_000)): Run =>
  Run.start(
    {
      id: 'run-1',
      agent: 'veronica',
      task: 'daily-digest',
      trigger: RunTrigger.SCHEDULE,
      model: 'stub:m',
    },
    clock,
  );

describe('Run', () => {
  it('starts running with empty totals', () => {
    expect(startRun().snapshot()).toEqual({
      id: 'run-1',
      agent: 'veronica',
      task: 'daily-digest',
      trigger: RunTrigger.SCHEDULE,
      model: 'stub:m',
      status: RunStatus.RUNNING,
      startedAtMs: 1_000,
      turns: 0,
      usage: EMPTY_USAGE,
      costUsd: 0,
      toolCalls: {},
    });
  });

  it('accumulates turns, tokens, cost and tool calls', () => {
    const run = startRun();
    const usage = { ...EMPTY_USAGE, inputTokens: 10, outputTokens: 5 };

    run.recordTurn(usage, 0.01, 'stub:a');
    run.recordTurn(usage, 0.02, 'stub:b');
    run.recordToolCall('lookup');
    run.recordToolCall('lookup');
    run.recordToolCall('other');

    expect(run.snapshot()).toMatchObject({
      model: 'stub:b',
      turns: 2,
      usage: { inputTokens: 20, outputTokens: 10 },
      toolCalls: { lookup: 2, other: 1 },
    });
    expect(run.costUsd).toBeCloseTo(0.03);
  });

  const expectedStatus: Record<RunStopReason, RunStatus> = {
    [RunStopReason.END]: RunStatus.COMPLETED,
    [RunStopReason.MAX_TURNS]: RunStatus.STOPPED,
    [RunStopReason.MAX_TOKENS]: RunStatus.STOPPED,
    [RunStopReason.BUDGET_EXCEEDED]: RunStatus.STOPPED,
    [RunStopReason.REFUSAL]: RunStatus.STOPPED,
    [RunStopReason.TIMEOUT]: RunStatus.STOPPED,
    [RunStopReason.INVALID_OUTPUT]: RunStatus.STOPPED,
    [RunStopReason.MODEL_ERROR]: RunStatus.FAILED,
    [RunStopReason.UNEXPECTED_ERROR]: RunStatus.FAILED,
    [RunStopReason.INTERRUPTED]: RunStatus.INTERRUPTED,
  };

  it.each(Object.values(RunStopReason))('maps stop reason %s to a status', (stopReason) => {
    const status = expectedStatus[stopReason];
    const clock = new FixedClock(1_000);
    const run = startRun(clock);
    clock.advance(500);

    run.finish(stopReason, clock, 'detail');

    expect(run.snapshot()).toMatchObject({
      status,
      stopReason,
      stopDetail: 'detail',
      finishedAtMs: 1_500,
    });
    expect(run.isRunning).toBe(false);
  });

  it('refuses any change after it finished', () => {
    const clock = new FixedClock();
    const run = startRun(clock);
    run.finish(RunStopReason.END, clock);

    expect(() => run.recordToolCall('lookup')).toThrow(RunAlreadyFinishedError);
    expect(() => run.recordTurn(EMPTY_USAGE, 0, 'stub:m')).toThrow(RunAlreadyFinishedError);
    expect(() => run.finish(RunStopReason.END, clock)).toThrow(RunAlreadyFinishedError);
  });

  it('is marked interrupted, not resumed', () => {
    const clock = new FixedClock();
    const run = startRun(clock);

    run.markInterrupted(clock);

    expect(run.snapshot()).toMatchObject({
      status: RunStatus.INTERRUPTED,
      stopReason: RunStopReason.INTERRUPTED,
    });
  });

  it('rejects negative, infinite and NaN costs and token counts', () => {
    const run = startRun();

    expect(() => run.recordTurn(EMPTY_USAGE, -0.01, 'stub:m')).toThrow(InvalidRunValueError);
    expect(() => run.recordTurn(EMPTY_USAGE, Number.NaN, 'stub:m')).toThrow(InvalidRunValueError);
    expect(() => run.recordTurn(EMPTY_USAGE, Infinity, 'stub:m')).toThrow(InvalidRunValueError);
    expect(() => run.recordTurn({ ...EMPTY_USAGE, inputTokens: -1 }, 0, 'stub:m')).toThrow(
      InvalidRunValueError,
    );
    expect(run.turns).toBe(0);
  });

  it('never exposes the shared empty usage to mutation', () => {
    const snapshot = startRun().snapshot();

    snapshot.usage.inputTokens = 999;

    expect(EMPTY_USAGE.inputTokens).toBe(0);
    expect(startRun().snapshot().usage.inputTokens).toBe(0);
  });

  it('refuses to restore an inconsistent snapshot', () => {
    const running = startRun().snapshot();

    expect(() => Run.restore({ ...running, status: RunStatus.COMPLETED })).toThrow(
      InvalidRunSnapshotError,
    );
    expect(() =>
      Run.restore({ ...running, stopReason: RunStopReason.END, finishedAtMs: 2_000 }),
    ).toThrow(InvalidRunSnapshotError);
  });

  it('restores from a snapshot without sharing state', () => {
    const run = startRun();
    run.recordToolCall('lookup');
    const snapshot = run.snapshot();

    const restored = Run.restore(snapshot);
    restored.recordToolCall('lookup');

    expect(snapshot.toolCalls).toEqual({ lookup: 1 });
    expect(restored.snapshot().toolCalls).toEqual({ lookup: 2 });
  });

  it('sums cost across any sequence of turns', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 10, noNaN: true }), { maxLength: 20 }),
        (costs) => {
          const run = startRun();
          costs.forEach((cost) => run.recordTurn(EMPTY_USAGE, cost, 'stub:m'));
          expect(run.turns).toBe(costs.length);
          expect(run.costUsd).toBeCloseTo(
            costs.reduce((sum, cost) => sum + cost, 0),
            6,
          );
        },
      ),
    );
  });
});
