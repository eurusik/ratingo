import { randomUUID } from 'node:crypto';

import { Inject, Injectable, Logger } from '@nestjs/common';

import {
  CLOCK_PORT,
  RUN_REPOSITORY,
  Run,
  RunStopReason,
  RunTrigger,
  type AgentFolder,
  type ClockPort,
  type RunRepository,
} from '@ratingo/ai-core';

import { AGENT_FOLDER } from '../../../../core/ai-core.constants';
import { CHAT_TASK_NAME, NO_MODEL } from '../../chat.constants';
import { ChatAction, CHAT_TRANSPORT, type ChatTransportPort } from '../../../notify/public';
import { ChatOutcome, ChatRoute, CommandLabel } from '../../domain/constants/chat.constants';
import {
  COMMAND_FAILED_REPLY,
  UNKNOWN_COMMAND_REPLY,
} from '../../domain/constants/chat-replies.constants';
import type { IncomingMessage } from '../../domain/entities/incoming-message';
import { HappyReviewMode } from '../../domain/entities/happy';
import { IntentKind, type HappyTarget, type Intent } from '../../domain/entities/intent';
import { CHAT_METRICS_PORT, type ChatMetricsPort } from '../../domain/ports/chat-metrics.port';
import { routeMessage } from '../../domain/policies/route-message.policy';
import { ChatCommandHandlers } from '../commands/chat-command.handlers';

import { ChatExchangeRecorder } from './chat-exchange-recorder.service';
import { HappyChatService } from './happy-chat.service';
import { InvestigationRunner } from './investigation.runner';
import { loggedToolCalls } from './logged-tool-calls';

const commandLabelOf = (intent: Intent): CommandLabel => {
  switch (intent.kind) {
    case IntentKind.COMMAND:
      return intent.command;
    case IntentKind.UNKNOWN_COMMAND:
      return CommandLabel.UNKNOWN;
    case IntentKind.MENTION:
    case IntentKind.HAPPY:
    case IntentKind.FREE_FORM:
      return CommandLabel.FREE_TEXT;
  }
};

const routeOf = (intent: Intent): ChatRoute => {
  switch (intent.kind) {
    case IntentKind.COMMAND:
    case IntentKind.UNKNOWN_COMMAND:
      return ChatRoute.COMMAND;
    case IntentKind.HAPPY:
      return ChatRoute.HAPPY;
    case IntentKind.MENTION:
    case IntentKind.FREE_FORM:
      return ChatRoute.INVESTIGATION;
  }
};

type InvestigationIntent = Extract<
  Intent,
  { kind: typeof IntentKind.MENTION | typeof IntentKind.FREE_FORM }
>;

const isInvestigationIntent = (intent: Intent): intent is InvestigationIntent =>
  intent.kind === IntentKind.MENTION || intent.kind === IntentKind.FREE_FORM;

const errorName = (error: unknown): string => (error instanceof Error ? error.name : 'error');

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly commands: ChatCommandHandlers,
    private readonly investigation: InvestigationRunner,
    private readonly happy: HappyChatService,
    private readonly exchanges: ChatExchangeRecorder,
    @Inject(CHAT_TRANSPORT) private readonly transport: ChatTransportPort,
    @Inject(CHAT_METRICS_PORT) private readonly metrics: ChatMetricsPort,
    @Inject(CLOCK_PORT) private readonly clock: ClockPort,
    @Inject(RUN_REPOSITORY) private readonly runs: RunRepository,
    @Inject(AGENT_FOLDER) private readonly folder: AgentFolder,
  ) {}

  async handle(message: IncomingMessage): Promise<ChatOutcome> {
    const intent = routeMessage(message.text);
    if (isInvestigationIntent(intent)) {
      return this.investigate(intent, message);
    }
    const route = routeOf(intent);
    let answer = '';
    let failed = false;
    const run = Run.start(
      {
        id: randomUUID(),
        agent: this.folder.manifest.name,
        task: CHAT_TASK_NAME,
        trigger: RunTrigger.CHAT,
        model: NO_MODEL,
      },
      this.clock,
    );
    try {
      const reply = await this.replyFor(intent, message.chatId);
      await this.transport.sendMessage(message.chatId, reply.html);
      answer = reply.html;
      failed = reply.failed;
      run.finish(reply.failed ? RunStopReason.UNEXPECTED_ERROR : RunStopReason.END, this.clock);
      this.metrics.record({
        outcome: reply.failed ? ChatOutcome.FAILED : ChatOutcome.HANDLED,
        command: commandLabelOf(intent),
        route,
      });
      return reply.failed ? ChatOutcome.FAILED : ChatOutcome.HANDLED;
    } catch (error) {
      failed = true;
      run.finish(RunStopReason.UNEXPECTED_ERROR, this.clock, errorName(error));
      this.metrics.record({
        outcome: ChatOutcome.FAILED,
        command: commandLabelOf(intent),
        route,
      });
      throw error;
    } finally {
      const saved = await this.saveRun(run);
      await this.exchanges.record({
        runId: saved ? run.snapshot().id : null,
        chatId: message.chatId,
        route,
        question: message.text,
        answer,
        outcome: failed ? ChatOutcome.FAILED : ChatOutcome.HANDLED,
      });
    }
  }

  private async investigate(
    intent: InvestigationIntent,
    message: IncomingMessage,
  ): Promise<ChatOutcome> {
    const event = { command: commandLabelOf(intent), route: ChatRoute.INVESTIGATION };
    try {
      const result = await this.investigation.answer(message.chatId, intent.text);
      this.metrics.record({ ...event, outcome: result.outcome });
      await this.exchanges.record({
        runId: result.runId,
        chatId: message.chatId,
        route: ChatRoute.INVESTIGATION,
        question: intent.text,
        answer: result.html,
        outcome: result.outcome,
        cutNumbers: result.unverifiedNumbers,
        toolNames: result.toolCalls.map((call) => call.tool),
        toolCalls: loggedToolCalls(result.toolCalls),
      });
      return result.outcome;
    } catch (error) {
      this.metrics.record({ ...event, outcome: ChatOutcome.FAILED });
      throw error;
    }
  }

  private async replyFor(
    intent: Exclude<Intent, InvestigationIntent>,
    chatId: string,
  ): Promise<{ html: string; failed: boolean }> {
    switch (intent.kind) {
      case IntentKind.COMMAND:
        return this.runCommand(intent, chatId);
      case IntentKind.UNKNOWN_COMMAND:
        return { html: UNKNOWN_COMMAND_REPLY, failed: false };
      case IntentKind.HAPPY:
        return this.askHappy(intent.target, chatId, intent.mode ?? HappyReviewMode.AUTO);
    }
  }

  private async askHappy(
    target: HappyTarget,
    chatId: string,
    mode: HappyReviewMode,
  ): Promise<{ html: string; failed: boolean }> {
    await this.showTyping(chatId);
    return { html: await this.happy.reply(chatId, target, mode), failed: false };
  }

  private async runCommand(
    intent: Extract<Intent, { kind: typeof IntentKind.COMMAND }>,
    chatId: string,
  ): Promise<{ html: string; failed: boolean }> {
    await this.showTyping(chatId);
    try {
      return { html: await this.commands.execute(intent.command, chatId), failed: false };
    } catch (error) {
      this.logger.error(`Команда ${intent.command} не вдалася: ${errorName(error)}`);
      return { html: COMMAND_FAILED_REPLY, failed: true };
    }
  }

  private async showTyping(chatId: string): Promise<void> {
    try {
      await this.transport.sendChatAction(chatId, ChatAction.TYPING);
    } catch (error) {
      this.logger.warn(`Індикатор набору не показано: ${errorName(error)}`);
    }
  }

  private async saveRun(run: Run): Promise<boolean> {
    try {
      await this.runs.save(run.snapshot());
      return true;
    } catch (error) {
      this.logger.warn(`Запуск чату не збережено: ${errorName(error)}`);
      return false;
    }
  }
}
