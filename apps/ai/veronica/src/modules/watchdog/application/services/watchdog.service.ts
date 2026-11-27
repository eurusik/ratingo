import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';
import { kyivDateOf } from '@ratingo/ai-ops-tools';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import {
  CHAT_BUDGET_PER_DAY_USD,
  CHAT_BUDGET_WINDOW_MS,
  CHAT_TASK_NAME,
} from '../../../chat/public';
import { NOTIFIER_PORT, type NotifierPort } from '../../../notify/public';
import {
  FAILED_RUNS_WINDOW_MS,
  RECOVERY_TEXT,
} from '../../domain/constants/watchdog-rules.constants';
import type { CheckResult } from '../../domain/entities/check-result';
import { reconcileAlerts } from '../../domain/policies/alert-reconcile.policy';
import { evaluateAgentBudget, evaluateChatBudget } from '../../domain/policies/budget.policy';
import { evaluateDigest } from '../../domain/policies/digest-deadline.policy';
import { evaluateFailedRuns } from '../../domain/policies/failed-runs.policy';
import { evaluateHappy, nextHappyFailures } from '../../domain/policies/happy-health.policy';
import {
  DIGEST_DELIVERY_PROBE_PORT,
  FAILED_RUNS_PORT,
  HAPPY_HEALTH_PORT,
  WATCHDOG_HEARTBEAT_PORT,
  WATCHDOG_STATE_PORT,
  type DigestDeliveryProbePort,
  type FailedRunsPort,
  type HappyHealthPort,
  type WatchdogHeartbeatPort,
  type WatchdogStatePort,
} from '../../domain/ports/watchdog.ports';

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class WatchdogService {
  private readonly logger = new Logger(WatchdogService.name);

  constructor(
    @Inject(HAPPY_HEALTH_PORT) private readonly happy: HappyHealthPort,
    @Inject(DIGEST_DELIVERY_PROBE_PORT) private readonly digests: DigestDeliveryProbePort,
    @Inject(FAILED_RUNS_PORT) private readonly failedRuns: FailedRunsPort,
    @Inject(WATCHDOG_STATE_PORT) private readonly state: WatchdogStatePort,
    @Inject(WATCHDOG_HEARTBEAT_PORT) private readonly heartbeat: WatchdogHeartbeatPort,
    @Inject(NOTIFIER_PORT) private readonly notifier: NotifierPort,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
  ) {}

  async tick(): Promise<string> {
    const nowMs = this.clock.nowMs();
    const previouslyActive = await this.state.loadActive();
    const results = (
      await Promise.all([
        this.checked('happy', () => this.checkHappy()),
        this.checked('digest', () => this.checkDigest(nowMs)),
        this.checked('budget', () => this.checkBudgets(nowMs)),
        this.checked('failed-runs', () => this.checkFailedRuns(nowMs)),
      ])
    ).flat();
    this.heartbeat.beat(nowMs);
    const { raised, recovered, active } = reconcileAlerts(previouslyActive, results);
    for (const finding of raised) {
      await this.notifier.send({ html: finding.text, silent: false });
    }
    for (const key of recovered) {
      await this.notifier.send({ html: RECOVERY_TEXT[key], silent: false });
    }
    await this.state.saveActive(active);
    return `raised:${raised.length} recovered:${recovered.length} active:${active.length}`;
  }

  private async checked(name: string, check: () => Promise<CheckResult[]>): Promise<CheckResult[]> {
    try {
      return await check();
    } catch (error) {
      this.logger.warn(`Перевірка «${name}» не вдалася: ${errorName(error)}`);
      return [];
    }
  }

  private async checkHappy(): Promise<CheckResult[]> {
    const probe = await this.happy.probe();
    const failures = nextHappyFailures(await this.state.loadHappyFailures(), probe);
    await this.state.saveHappyFailures(failures);
    const result = evaluateHappy(failures, probe);
    return result === null ? [] : [result];
  }

  private async checkDigest(nowMs: number): Promise<CheckResult[]> {
    const delivered = await this.digests.isSentOn(kyivDateOf(nowMs));
    const result = evaluateDigest(nowMs, delivered);
    return result === null ? [] : [result];
  }

  private async checkBudgets(nowMs: number): Promise<CheckResult[]> {
    const agent = this.folder.manifest.name;
    const sinceMs = nowMs - CHAT_BUDGET_WINDOW_MS;
    const [agentUsd, chatUsd] = await Promise.all([
      this.runs.spentUsd({ agent, sinceMs }),
      this.runs.spentUsd({ agent, task: CHAT_TASK_NAME, sinceMs }),
    ]);
    return [
      evaluateAgentBudget({
        spentUsd: agentUsd,
        limitUsd: this.folder.manifest.budgets.perDayUsd,
      }),
      evaluateChatBudget({ spentUsd: chatUsd, limitUsd: CHAT_BUDGET_PER_DAY_USD }),
    ];
  }

  private async checkFailedRuns(nowMs: number): Promise<CheckResult[]> {
    const count = await this.failedRuns.countFailedSince(
      this.folder.manifest.name,
      nowMs - FAILED_RUNS_WINDOW_MS,
    );
    return [evaluateFailedRuns(count)];
  }
}
