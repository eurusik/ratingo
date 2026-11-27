import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK_PORT, type AgentFolder, type ClockPort, type RunTrigger } from '@ratingo/ai-core';
import { createOpsTools, type OpsExecutors } from '@ratingo/ai-ops-tools';

import { AGENT_FOLDER, OPS_EXECUTORS } from '../../../../core/ai-core.constants';
import { AgentRunner } from '../../../../core/agent-runner.service';
import { MAX_QUESTION_CHARS } from '../../investigation.constants';
import { CODE_SNAPSHOT_PORT, type CodeSnapshotPort } from '../../domain/ports/code-snapshot.port';
import {
  PATTERN_MATCHER_PORT,
  type PatternMatcherPort,
} from '../../domain/ports/pattern-matcher.port';
import {
  InvestigationStatus,
  type InvestigationOutcome,
} from '../../domain/entities/investigation-outcome';
import type { InvestigationDraft } from '../../domain/entities/investigation-answer';
import { AssumptionOrigin } from '../../domain/entities/investigation-answer';
import { InvalidQuestionError } from '../../domain/errors/invalid-question.error';
import { SnapshotUnavailableError } from '../../domain/errors/investigation.errors';
import { verifyAnswer } from '../../domain/policies/answer-verifier';
import { EvidenceLedger } from '../../domain/policies/evidence-ledger';
import { RuntimeEvidenceLedger } from '../../domain/policies/runtime-evidence-ledger';
import { investigationDraftSchema } from '../schemas/investigation-draft.schema';
import { createCodeTools } from '../tools/create-code-tools';
import { createRuntimeEvidenceDecorator } from '../tools/runtime-evidence.decorator';
import { CodeBrowser } from './code-browser.service';

const PROMPT_NAME = 'investigate';
const FINAL_ANSWER_PROMPT_NAME = 'final-answer';

export interface InvestigationRequest {
  question: string;
  ref: string;
  trigger: RunTrigger;
  budgetUsd?: number;
  ignoreDailyBudget?: boolean;
}

const emptyOutcome = (ref: string): InvestigationOutcome => ({
  status: InvestigationStatus.UNANSWERED,
  ref,
  commit: null,
  answer: null,
  runId: null,
  stopReason: null,
  stopDetail: null,
  turns: 0,
  costUsd: 0,
  toolCalls: {},
  pathsRead: [],
  snapshotFailure: null,
});

@Injectable()
export class InvestigationService {
  private readonly logger = new Logger(InvestigationService.name);
  private readonly browser: CodeBrowser;

  constructor(
    @Inject(CODE_SNAPSHOT_PORT) private readonly snapshots: CodeSnapshotPort,
    @Inject(CLOCK_PORT) clock: ClockPort,
    @Inject(PATTERN_MATCHER_PORT) matcher: PatternMatcherPort,
    private readonly runner: AgentRunner,
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
    @Inject(OPS_EXECUTORS) private readonly ops: OpsExecutors,
  ) {
    this.browser = new CodeBrowser(clock, matcher);
  }

  async investigate(request: InvestigationRequest): Promise<InvestigationOutcome> {
    const question = request.question.trim();
    if (question === '') throw new InvalidQuestionError('the question is empty');
    if (question.length > MAX_QUESTION_CHARS) {
      throw new InvalidQuestionError(
        `the question is longer than ${MAX_QUESTION_CHARS} characters`,
      );
    }
    const system = this.folder.prompts[PROMPT_NAME];
    const finalAnswerPrompt = this.folder.prompts[FINAL_ANSWER_PROMPT_NAME];
    if (system === undefined || finalAnswerPrompt === undefined) {
      throw new Error(
        `The agent folder needs the ${PROMPT_NAME} and ${FINAL_ANSWER_PROMPT_NAME} prompts`,
      );
    }
    let snapshot;
    try {
      snapshot = await this.snapshots.resolve(request.ref);
    } catch (error) {
      if (error instanceof SnapshotUnavailableError) {
        this.logger.warn({
          message: 'investigation.snapshot_unavailable',
          ref: request.ref,
          failure: error.failure,
        });
        return {
          ...emptyOutcome(request.ref),
          status: InvestigationStatus.SNAPSHOT_UNAVAILABLE,
          snapshotFailure: error.failure,
        };
      }
      throw error;
    }
    const ledger = new EvidenceLedger();
    const runtime = new RuntimeEvidenceLedger();
    const { metricsQuery, jobFailures, logsSearch } = createOpsTools(this.ops, {
      decorate: createRuntimeEvidenceDecorator(runtime),
    });
    const result = await this.runner.run({
      trigger: request.trigger,
      system,
      finalAnswerPrompt,
      prompt: `Commit ${snapshot.sha} (${snapshot.ref}).\n\nQuestion from the owner:\n${question}`,
      responseSchema: investigationDraftSchema,
      tools: [
        ...createCodeTools({ browser: this.browser, snapshot, ledger }),
        metricsQuery,
        jobFailures,
        logsSearch,
      ],
      ...(request.budgetUsd === undefined ? {} : { budgetUsd: request.budgetUsd }),
      ...(request.ignoreDailyBudget === undefined
        ? {}
        : { ignoreDailyBudget: request.ignoreDailyBudget }),
    });
    const draft = result.value as InvestigationDraft | undefined;
    const answer = draft === undefined ? null : verifyAnswer(draft, snapshot, ledger, runtime);
    const outcome: InvestigationOutcome = {
      status: answer === null ? InvestigationStatus.UNANSWERED : InvestigationStatus.ANSWERED,
      ref: snapshot.ref,
      commit: snapshot.sha,
      answer,
      runId: result.run.id,
      stopReason: result.run.stopReason ?? null,
      stopDetail: result.run.stopDetail ?? null,
      turns: result.run.turns,
      costUsd: result.run.costUsd,
      toolCalls: result.run.toolCalls,
      pathsRead: ledger.pathsRead(),
      snapshotFailure: null,
    };
    this.logger.log({
      message: 'investigation.finished',
      runId: outcome.runId,
      status: outcome.status,
      support: answer?.support ?? null,
      facts: answer?.facts.length ?? 0,
      unverifiedClaims:
        answer?.assumptions.filter((entry) => entry.origin === AssumptionOrigin.UNVERIFIED_CLAIM)
          .length ?? 0,
      stopReason: outcome.stopReason,
      stopDetail: outcome.stopDetail,
      turns: outcome.turns,
      costUsd: outcome.costUsd,
    });
    return outcome;
  }
}
