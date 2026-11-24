import type { Attributes, Counter, Histogram, Meter } from '@opentelemetry/api';
import {
  AI_METRIC_ATTRIBUTES,
  AI_METRIC_NAMES,
  AI_METRIC_UNITS,
  AI_TOKEN_KINDS,
  NO_TASK_LABEL,
} from '../telemetry/ai-metric-names';
import { RunStatus } from './run';
import type { RunSnapshot } from './run';
import type { RunLogger } from './run-logger.port';
import type { RunRepository, SpendQuery } from './run.repository';

export const RUN_FINISHED_EVENT = 'ai.run.finished';
const MS_PER_SECOND = 1000;
const COST_BUCKETS_USD = [0.0005, 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1];
const DURATION_BUCKETS_SECONDS = [1, 2.5, 5, 10, 20, 30, 60, 120, 300];
const MAX_REMEMBERED_RUNS = 1000;

function durationSeconds(run: RunSnapshot): number {
  return ((run.finishedAtMs ?? run.startedAtMs) - run.startedAtMs) / MS_PER_SECOND;
}

function baseAttributes(run: RunSnapshot): Attributes {
  return {
    [AI_METRIC_ATTRIBUTES.AGENT]: run.agent,
    [AI_METRIC_ATTRIBUTES.TASK]: run.task ?? NO_TASK_LABEL,
    [AI_METRIC_ATTRIBUTES.TRIGGER]: run.trigger,
  };
}

export class TelemetryRunRepository implements RunRepository {
  private readonly runCounter: Counter;
  private readonly costHistogram: Histogram;
  private readonly tokenCounter: Counter;
  private readonly durationHistogram: Histogram;
  private readonly toolCallCounter: Counter;
  private readonly reported = new Set<string>();

  constructor(
    meter: Meter,
    private readonly logger: RunLogger,
    private readonly inner: RunRepository,
  ) {
    this.runCounter = meter.createCounter(AI_METRIC_NAMES.RUNS);
    this.costHistogram = meter.createHistogram(AI_METRIC_NAMES.RUN_COST, {
      unit: AI_METRIC_UNITS.COST,
      advice: { explicitBucketBoundaries: COST_BUCKETS_USD },
    });
    this.tokenCounter = meter.createCounter(AI_METRIC_NAMES.RUN_TOKENS, {
      unit: AI_METRIC_UNITS.TOKENS,
    });
    this.durationHistogram = meter.createHistogram(AI_METRIC_NAMES.RUN_DURATION, {
      unit: AI_METRIC_UNITS.DURATION,
      advice: { explicitBucketBoundaries: DURATION_BUCKETS_SECONDS },
    });
    this.toolCallCounter = meter.createCounter(AI_METRIC_NAMES.TOOL_CALLS);
  }

  async save(run: RunSnapshot): Promise<void> {
    await this.inner.save(run);
    if (run.status !== RunStatus.RUNNING && this.markReported(run.id)) {
      this.recordMetrics(run);
      this.logFinished(run);
    }
  }

  findRunning(agent: string): Promise<RunSnapshot[]> {
    return this.inner.findRunning(agent);
  }

  spentUsd(query: SpendQuery): Promise<number> {
    return this.inner.spentUsd(query);
  }

  private markReported(runId: string): boolean {
    if (this.reported.has(runId)) {
      return false;
    }
    this.reported.add(runId);
    if (this.reported.size > MAX_REMEMBERED_RUNS) {
      const oldest = this.reported.values().next().value;
      if (oldest !== undefined) {
        this.reported.delete(oldest);
      }
    }
    return true;
  }

  private recordMetrics(run: RunSnapshot): void {
    const base = baseAttributes(run);
    this.runCounter.add(1, {
      ...base,
      [AI_METRIC_ATTRIBUTES.OUTCOME]: run.stopReason ?? run.status,
    });
    this.costHistogram.record(run.costUsd, base);
    this.durationHistogram.record(durationSeconds(run), base);
    this.recordTokens(run, base);
    for (const [tool, count] of Object.entries(run.toolCalls)) {
      this.toolCallCounter.add(count, { ...base, [AI_METRIC_ATTRIBUTES.TOOL]: tool });
    }
  }

  private recordTokens(run: RunSnapshot, base: Attributes): void {
    const byKind: Record<string, number> = {
      [AI_TOKEN_KINDS.INPUT]: run.usage.inputTokens,
      [AI_TOKEN_KINDS.OUTPUT]: run.usage.outputTokens,
      [AI_TOKEN_KINDS.CACHE_READ]: run.usage.cacheReadTokens,
      [AI_TOKEN_KINDS.CACHE_WRITE]: run.usage.cacheWriteTokens,
      [AI_TOKEN_KINDS.REASONING]: run.usage.reasoningTokens,
    };
    for (const [kind, count] of Object.entries(byKind)) {
      this.tokenCounter.add(count, { ...base, [AI_METRIC_ATTRIBUTES.TOKEN_KIND]: kind });
    }
  }

  private logFinished(run: RunSnapshot): void {
    this.logger.info(RUN_FINISHED_EVENT, {
      runId: run.id,
      agent: run.agent,
      task: run.task,
      trigger: run.trigger,
      status: run.status,
      stopReason: run.stopReason,
      turns: run.turns,
      costUsd: run.costUsd,
      inputTokens: run.usage.inputTokens,
      outputTokens: run.usage.outputTokens,
      cacheReadTokens: run.usage.cacheReadTokens,
      cacheWriteTokens: run.usage.cacheWriteTokens,
    });
  }
}
